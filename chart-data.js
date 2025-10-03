const ctx = document.getElementById('myChart').getContext('2d');

// const data = [
// 	{x: 1, y: 1, label: "1"}
// ]

console.log(window.data);

function getRandomColor() {
  const r = Math.floor(Math.random() * 255);
  const g = Math.floor(Math.random() * 255);
  const b = Math.floor(Math.random() * 255);
  return `rgb(${r}, ${g}, ${b})`;
}



const myChart = new Chart(ctx, {
		type: 'scatter',
		data: {
				datasets: [{
						label: 'Youtube channels',
						data: window.data,
						pointBackgroundColor: window.data.map(() => getRandomColor()),
						pointRadius: 10
				}]
		},
		options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
						datalabels: {
								align: 'top',
								anchor: 'end',
								formatter: function(value, context) {
										return value.label || '';
								},
								font: {
										weight: 'bold'
								}
						},
						zoom: {
							pan: {
									enabled: true,
									mode: 'xy'
							},
							zoom: {
								wheel: {
									enabled: true,
								},
								pinch: {
									enabled: true
								},
								mode: 'xy',
							}
						}
				},
				scales: {
						x: {
								type: 'linear',
								position: 'bottom',
								title: { display: true, text: 'Avg. views/video for last 10 videos' }
						},
						y: {
								title: { display: true, text: 'Avg. vidoes/month of last 10 videos' }
						}
				}
		},
		plugins: [window.ChartDataLabels, window.ChartZoom]
});