self.port.on("show", function (unstableJobs, unstableTimes) {
	console.log("the status panel is now shown");
	console.log("unstableJobs : ", JSON.stringify(unstableJobs));
	console.log("unstableTimes: ", JSON.stringify(unstableTimes));
	
	self.updateJobsTable(unstableJobs, unstableTimes);
	if ( !self.initialized ) {
		self.registerClickListener();
		self.initialized = true;
	}
});

self.updateJobsTable = function(jobs, unstableTimes)
{
	console.log("update jobs table");
	
	if (jobs.length == 0) {
		$("#jobs-table").hide();
		$("#stable-message").show();
	} else {
		
		$(".job-row").remove();
		
		for (i in jobs) {
			var job = jobs[i];
			var row = "<tr class='job-row'>"
				+ "<td>"
				+ "<a href='" + job.url + "'>"
				+ job.name
				+ "</a>"
				+ "</td>"
				+ "<td>"
				+ self.getTimeDiffString(unstableTimes[job.name])
				+ "</td>"
				+ "</tr>"
			$("#jobs-table").append(row);
		}
			
		$("#jobs-table").show();
		$("#stable-message").hide();
	}
}

self.getTimeDiffString = function(dateString)
{
	/* the date comes as a string */
	var date = new Date();
	date.setTime(Date.parse(dateString));
	
	var diffInMillis = new Date().getTime() - date.getTime();
	var diffInMinutes = Math.floor(diffInMillis / 60000);
	var diffInHours = Math.floor(diffInMinutes / 60);
	var diffModMinutes = diffInMinutes % 60;
	if ( diffInHours > 0 ) {
		return diffInHours + "h " + diffModMinutes + "m";
	} else {
		return diffModMinutes + "m";
	}
}

/**
 * Intercept click events from the status panel
 */
self.registerClickListener = function() 
{
	$(window).click(function (event) {
		  var t = event.target;
		 
		  // Don't intercept the click if it isn't on a link.
		  if (t.nodeName != "A")
		    return;
		 
		  // Don't intercept the click if it was on one of the links in the header
		  // or next/previous footer, since those links should load in the panel itself.
		  if ($(t).parents('#header').length || $(t).parents('.nextprev').length)
		    return;
		 
		  // Intercept the click, passing it to the addon, which will load it in a tab.
		  event.stopPropagation();
		  event.preventDefault();
		  self.port.emit('click', t.toString());
		});
}

