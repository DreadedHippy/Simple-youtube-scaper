const puppeteer = require('puppeteer');

function delay(time) {
	return new Promise(function(resolve) { 
			setTimeout(resolve, time)
	});
}

const scrapeInfiniteScrollItems = async (page, extractItems, itemCount, scrollDelay = 2000) => {
  let items = [];

  while (items.length < itemCount) {
		console.log(`Found ${items.length} channels...`);
    const previousHeight = await page.evaluate(
      "document.querySelector('div#container.ytd-search.style-scope').scrollHeight"
    );
    await page.evaluate(() => {
      const youtubeScrollHeight =
        document.querySelector("div#container.ytd-search.style-scope").scrollHeight;
      window.scrollTo(0, youtubeScrollHeight);
    });
    try {
      await page.waitForFunction(
        `document.querySelector('div#container.ytd-search.style-scope')?.scrollHeight > ${previousHeight}`,
        { timeout: 5000 }
      );
    } catch {
      console.log("done");
      break;
    }
		items = await page.evaluate(extractItems);
    await delay(scrollDelay);
  }

	console.log(`Found ${items.length} channels`);

	return items;
};

function extractItems() {
	/*  For extractedElements, you are selecting the tag and class,
		that holds your desired information,
		then choosing the disired child element you would like to scrape from.
		in this case, you are selecting the
		"<div class=blog-post />" from "<div class=container />" See below: */
	
	const channelElems = Array.from(document.querySelectorAll('ytd-channel-renderer'));

	let links = [];

	for (const channelElem of channelElems) {
			let channelLink = channelElem.querySelector('a.yt-simple-endpoint')?.href;
			let channelName = channelElem.querySelector('ytd-channel-name yt-formatted-string')?.textContent;
			links.push([channelLink, channelName])
	}

	return links
}

async function getChannelsFromSearchQuery(query, rangeStart, rangeEnd) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
  	page.setViewport({ width: 1280, height: 926 });


		
    // Search for all channels for a given query
    await page.goto(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%253D%253D`, { waitUntil: 'networkidle2' });
    await page.waitForSelector("div#container.ytd-search.style-scope", { timeout: 10000 });
		

		console.log("Scraping channels");

		let channelLinks = await scrapeInfiniteScrollItems(page, extractItems, rangeEnd);

    // print channel links to console
    if (channelLinks.length < rangeStart || channelLinks.length < rangeEnd) {
        console.log(`Only retrieved ${channelLinks.length} channels, therefore could not get channels in the range of ${rangeStart} up to ${rangeEnd}`);
        browser.close();
        return
    }

    channelLinks = channelLinks.slice(rangeStart-1, rangeEnd);
    console.log(channelLinks);

    console.log("Processing channels, please wait...");
    let finalResult = [];

    // for each channel link, do something
		let numberOfChannels = channelLinks.length;
    for (let i = 0; i < numberOfChannels; i++) {
			let [channelLink, channelName] = channelLinks[i];
			console.log(`Processing channel ${i+1}...`);
      
        // console.log(channelLink);
        
        // Scrape channel page
        await page.goto(channelLink, { waitUntil: 'networkidle2' });
        await page.waitForSelector('.yt-core-attributed-string', { timeout: 10000 });

        
        // Get Subscriber count
        const subscriberCount = await page.evaluate(() => {
            let query = `yt-content-metadata-view-model span.yt-core-attributed-string.yt-content-metadata-view-model__metadata-text.yt-core-attributed-string--white-space-pre-wrap.yt-core-attributed-string--link-inherit-color`;
            const subscribeTextElem = document.querySelectorAll(query)[1].textContent.trim();
            return subscribeTextElem ? subscribeTextElem : "Subscriber count not found";
        });

        // console.log(subscriberCount)

        // Email link (if available)
        const emailLink = await page.evaluate(() => {
            const mailElem = Array.from(document.querySelectorAll('a')).find(a => a.href.startsWith('mailto:'));
            return mailElem ? mailElem.href : 'Email not found';
        });

        // console.log(emailLink);
        
        // Get last 10 videos
        await page.goto(`${channelLink}/videos`, { waitUntil: 'networkidle2' });
        await page.waitForSelector('ytd-rich-grid-renderer', { timeout: 10000 });
        
        const videos = await page.evaluate(() => {
            // get all video elems
            const videoElems = Array.from(document.querySelectorAll('ytd-rich-item-renderer'));

            // initialize result
            let result = []
            for (const videoElem of videoElems) {
                let viewsText = videoElem.querySelector('ytd-rich-grid-media ytd-video-meta-block span.ytd-video-meta-block')?.textContent || '';
                let dateText = videoElem.querySelectorAll('#metadata-line span')[1]?.textContent || '';
                const membersOnly = videoElem.querySelector('ytd-rich-grid-media ytd-badge-supported-renderer div.badge.badge-style-type-members-only')?.innerHTML ? true : false;

                
                if (membersOnly) { // if members only, cannot see views, so skip
                    continue
                    // [viewsText, dateText] = [dateText, viewsText]
                }

                result.push({viewsText, dateText});

                // we only need the most recent 10;

                if (result.length >= 10) {
                    break
                }
            }
            // return videoElems.map(el => {
            //     return { viewsText, dateText };
            // });

            return result;
        });

        // console.log(videos);
        
        let totalViews = 0, totalDays = 0;
        videos.forEach(({ viewsText, dateText }) => {
            const views = parseViews(viewsText);
            totalViews += views;
            totalDays += parseDaysAgo(dateText);
        });
        
        const avgViews = totalViews / videos.length;
        const avgUploadRate = videos.length / totalDays;

        const result = {
            channelName,
            channelLink,
            subscriberCount,
						x: avgViews,
						y: avgUploadRate,
						label: `${channelName}(${channelLink})`,
            avgViews: `${numberToAbbrev(Math.round(avgViews))} views/video for last 10 videos`,
            avgUploadRate: `${avgUploadRate.toFixed(2)} videos/month for last 10 videos`,
            emailLink
        }
        
        // return result
        finalResult.push(result);
    }

    console.log(finalResult);
    await browser.close();

		return finalResult;
}

function parseDaysAgo(daysAgo) {
	let s = daysAgo.split(' ');
	let num = parseInt(s[0]);

	return (num * parseTime(s[1]))/(24 * 30);
}

function parseTime(time) {
	switch(time) {
		case 'hour':
		case 'hours':
			return 1;
			break;
		case 'day':
		case 'days':
			return 24 * 1;
			break;
		case 'week':
		case 'weeks':
			return 7 * 24 * 1;
			break;
		case 'month':
		case 'months':
			return 30 * 24 * 1;
			break;
		case 'year':
		case 'years':
			return 365 * 24 * 1;
			break
		default:
			return 1
	}
}

function parseViews(viewsText) {
  let s = viewsText.split(' ')[0];
	const length = s.length;
	const lastLetter = s[length-1];
	if (Number.isNaN(parseInt(lastLetter))) {
		s = s.slice(0, -1);
		return parseInt(s) * convertFromLetter(lastLetter)
	} else {
		return parseInt(s)
	}

}

function convertFromLetter(letter) {
	switch (letter) {
		case 'K':
			return 1000;
			break
		case 'M':
			return 1000000;
			break
		default:
			return 1
		
	}
}

function numberToAbbrev(n) {
	let letter = '';

	if (n >= 1000) {
		letter = 'K';
		n = n/1000;
	}

	if (n >= 1000) {
		letter = 'M';
		n = n/1000;
	}

	if (n >= 1000) {
		letter = 'B';
		n = n/1000;
	}

	return `${n.toFixed(2)}${letter}`
}


function querySelectorParser(selector) {
	let s = selector.split(' ').join('.');
    return `.${s}`
}

let query;
let rangeStart = NaN;
let rangeEnd

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

async function getInputs() {
    const q = await askQuestion('Enter youtube query: ');
    query = q;

    let validStartRange = false;
    while (!validStartRange) {
        const r = await askQuestion('Enter start point: ');
        if (!isNaN(r)) {
            validStartRange = true;
            rangeStart = parseInt(r)
        } else {
            console.log("Invalid start point, please input an integer")
        }
    }

    let validEndRange = false;
    while (!validEndRange) {
        const r = await askQuestion('Enter end point: ');
        if (!isNaN(r)) {
            validEndRange = true;
            rangeEnd = parseInt(r)
        } else {
            console.log("Invalid end point, please input an integer")
        }
    }
    rl.close();

		return [query, rangeStart, rangeEnd];
}

module.exports = {getInputs, getChannelsFromSearchQuery};