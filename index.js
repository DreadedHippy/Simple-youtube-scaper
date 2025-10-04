const http = require('http');
const fs =  require('fs');
const fsp = require('fs').promises;
const path =  require('path');
const {getInputs, getChannelsFromSearchQuery, getChannelsFromVideoLink, askQuestion} = require('./get-inputs.js');


async function begin() {
    console.log("Starting channel retriever...");
    let input = 0;
    
    
    while (input !== '1' && input !== '2') {
       input = await askQuestion("Press 1 to retrieve by video link, press 2 to retrieve by Search query: ");
    }

    let result;

    console.log("\n");

    switch(input) {
        case '1':
            let videoLink = await askQuestion("Please enter a video link: ");
            result = await getChannelsFromVideoLink(videoLink);
            break;
        default:
            let [query, rangeStart, rangeEnd] = await getInputs();
            result = await getChannelsFromSearchQuery(query, rangeStart, rangeEnd);
    }


    console.log(result);
    
    const dataToWrite = `window.data = ${JSON.stringify(result)}`;
    const filePath = 'data-generator.js';

    try {
        await fsp.writeFile(filePath, dataToWrite);
        console.log('File written successfully!');
    } catch {
        console.error('Error writing to file:', err);
        return
    }

    startServer()

}

async function startServer() {
    
    const server = http.createServer((req, res) => {
        let filePath = '.' + req.url;
        if (filePath === './') filePath = './index.html';

        const extname = String(path.extname(filePath)).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml'
        };

        const contentType = mimeTypes[extname] || 'application/octet-stream';

        fs.readFile(filePath, (error, content) => {
            if (error) {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('404 Not Found', 'utf-8');
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    });


    const port = process.env.PORT || 3000;
    server.listen(port, () => {
        console.log(`Server running at http://localhost:${port}/`);
    });
}

begin();