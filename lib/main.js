const widgets = require("widget");
var Request = require("request").Request;
var timers = require("timers");
var notifications = require("notifications");
var prefs = require("simple-prefs");
var data = require("self").data;

var widget = null;

/**
 * The list of unstable jobs retrieved with the last poll.
 */
var lastUnstableJobs = new Array();

/**
 * Timestamps for the unstable jobs when they were first
 * retrieved as being unstable.
 * This is a map from job name to timestamp.
 */
var unstableTimes = new Object();

var pollingTimerId = null;

var isFirstPoll = true;

var wasLastPollSuccessful = true;

function isJobUnstable(job)
{
	var color = job.color;
	
	/* some colors are harmless */
	if ( (color == "aborted") || (color == "disabled") ) return false;
	
	/* job is unstable if color does not begin with 'blue' */
	return (job.color.substring(0,4) != "blue");
}

/**
 * Returns the array of jobs contained in jobs1 but not in jobs0.
 * The check for equality is done by the jobs name.
 * 
 * @param jobs1
 * @param jobs0
 */
function getJobsDifference(jobs1, jobs0)
{
	var result = new Array();
	for ( var i in jobs1) {
		var name = jobs1[i].name;
		if ( !containsJob(jobs0, name) ) {
			result.push(jobs1[i]);
		};
	}
	return result;
}

function containsJob(jobList, jobName)
{
	for ( var i in jobList) {
		if (jobList[i].name === jobName) return true;
	}
	return false;
}

function setWidgetStatus(status, tooltip)
{
	widget.tooltip = tooltip;
	
	if ( status == "stable" ) {
		widget.label = "jenkins is stable";
		widget.contentURL = data.url("blue.png");	
	} else if ( status == "unstable" ) {
		widget.label = "jenkins is unstable";
		widget.contentURL = data.url("red.png");
	} else {
		widget.label = "don't know";
		widget.contentURL = data.url("grey.png");
	}
}

function retrieveJenkinsStatus() 
{
	
	var url = prefs.prefs.jobsUrl + "?" +new Date().getTime();
	console.log("retrieving jobs from url: " + url);
	
	Request({
		/* make the url unique to prevent caching */
		url : url,
		onComplete : function(response) {

			var recoveredFromFailure = false;
			
			/* check if the response is parseable as json */
			if (response.json == null) {
				console.log("response: " + response.text);
				console.log("failed to parse response as json");
				setWidgetStatus("error","failed to retrieve jobs");
				wasLastPollSuccessful = false;
				lastUnstableJobs = new Array();
				return;
			} else if ( !wasLastPollSuccessful ) {
				/* polling is successful again */
				wasLastPollSuccessful = true;
				recoveredFromFailure = true;
				console.log("polling is successful again");
			}

			/* get the jobs array */
			var jobs = response.json.jobs;

			/* filter out unstable jobs */
			var unstableJobs = new Array();
			for ( var i in jobs) {
				if ( isJobUnstable(jobs[i]) ) {
//					console.log("job is unstable: " + jobs[i].name);
					unstableJobs.push(jobs[i]);
				}
			}

//			console.log("previous unstable: " + toString(lastUnstableJobs));
//			console.log("current unstable: " + toString(unstableJobs));
			
			var newUnstableJobs = getJobsDifference(unstableJobs, lastUnstableJobs);
			var newStableJobs = getJobsDifference(lastUnstableJobs, unstableJobs);
			console.log("new unstable jobs: " + toString(newUnstableJobs));
			console.log("new stable jobs  : " + toString(newStableJobs));
			
			/* adjust the unstableTimes map */
			adjustUnstableTimes(newStableJobs, newUnstableJobs);
			
			isFirstPoll = false;
			
			if ( !recoveredFromFailure 
					&& (newUnstableJobs.length == 0) 
					&& (newStableJobs.length == 0 ) ) 
			{
				/* nothing has changed since the last call */
				console.log("nothing has changed, finished poll");
				return;
			}
			
			var notificationTitle = "jenkins status changed";
			var notificationText = "";
			
			if ( newUnstableJobs.length > 0 ) {
				notificationText += "Now not stable: \n";
				for ( var i in newUnstableJobs) {
					notificationText += "- " + newUnstableJobs[i].name + "\n";
				}				
			}
			if ( newStableJobs.length > 0 ) {
				console.log(newStableJobs.length + " jobs are stable again");
				notificationText += "Stable again: \n";
				for (i in newStableJobs) {					
					notificationText += "- " + newStableJobs[i].name + "\n";
				}
			}
						
			/* set widget status */
			if ( unstableJobs.length == 0 ) {
				/* jenkins is stable */
				console.log("no unstable jobs found");
				setWidgetStatus("stable","no unstable jobs");
				notificationTitle += " (no unstable jobs)";
			} else {
				console.log("unstable jobs found");

				var widgetText = "";
				for ( var i in unstableJobs) {
					widgetText += unstableJobs[i].name + "\n";
				}
				
				setWidgetStatus("unstable", widgetText);
				
				notificationTitle += " (not stable: " + unstableJobs.length + ")";
			}
			
			/* notify */
			notifications.notify({
				  title: notificationTitle,
				  text: notificationText
				});
			
			lastUnstableJobs = unstableJobs;
			console.log("finished poll");
		}
	}).get();
}

function adjustUnstableTimes(newStableJobs, newUnstableJobs)
{
	/* the new stable jobs are removed from the map */
	for ( var i in newStableJobs ) {
		unstableTimes[newStableJobs[i].name] = undefined;
	}
	
	/* the new unstable jobs are added to the map */
	for ( var i in newUnstableJobs ) {
		
		unstableTimes[newUnstableJobs[i].name] = 0;
		retrieveLastNotStableBuildData(newUnstableJobs[i]);		
	}	
}

/**
 * Tries to retrieve the timestamp of the last build which was not stable 
 * (i.e. unstable or broken, see https://wiki.jenkins-ci.org/display/JENKINS/Terminology).
 * The timestamp is then used to update the unstableTimes map.
 * 
 * @param job
 */
function retrieveLastNotStableBuildData(job)
{
	console.log("retrieve last failed build data for job " + job.name);
	var cachePrevent = "?" +new Date().getTime();
	
	retrieveTimestamp(job.name, job.url + "/lastFailedBuild/api/json" + cachePrevent);
	retrieveTimestamp(job.name, job.url + "/lastUnstableBuild/api/json" + cachePrevent);
}

/**
 * Retrieves the timestamp from the given url
 * @param jobName
 * @param url
 */
function retrieveTimestamp(jobName, url)
{
	console.log("get timestamp for job ", jobName, " from url ", url);
	
	Request({
		url : url,
		onComplete : function(response) {

			if (response.json == null) {
				console.log("failed to retrieve timestamp from url: ", url);
				return;
			}
			
			var timestamp = new Date(response.json.timestamp);
			updateNotStableTime(jobName, timestamp);
		}
	}).get();	
}

function updateNotStableTime(jobName, timestamp)
{
	if ( (unstableTimes[jobName] == 0)
			|| isDateAfter(unstableTimes[jobName], timestamp) )
	{
		console.log("not stable time of job ", jobName, " is updated to ", timestamp);
		unstableTimes[jobName] = timestamp;		
	}
}

/**
 * Returns true if the second date is after the first one.
 * 
 * @param first
 * @param second
 */
function isDateAfter(first, second)
{
	return (first.getTime() < second.getTime());
}

function toString(jobs)
{
	var names = new Array();
	for ( var i in jobs) {
		names.push(jobs[i].name);
	}
	return names.join();
}

function onPollingIntervalChanged(prefName)
{
	console.log("polling interval changed to " + prefs.prefs.pollingInterval);
	startPollingTimer();
}

function onJobsUrlChanged(prefName)
{
	console.log("the jobs url has changed to " + prefs.prefs.jobsUrl);
	lastUnstableJobs = new Array();
}

function startPollingTimer()
{
	/* stop an already running timer */
	if ( pollingTimerId != null ) {
		timers.clearInterval(pollingTimerId);
	}
	
	console.log("starting polling timer with an interval of " 
			+ prefs.prefs.pollingInterval
			+ " seconds");
	pollingTimerId = timers.setInterval(retrieveJenkinsStatus,prefs.prefs.pollingInterval*1000);
}

var statusPanel = require("panel").Panel({
	  width:500,
	  height:300,
	  contentURL: data.url("status.html"),
	  contentScriptFile: [ 
	                      data.url("status.js"),
	                      data.url("jquery-1.7.2.min.js")]
	});

statusPanel.on("show", function() {
	console.log("show status panel");
	statusPanel.port.emit("show", lastUnstableJobs, unstableTimes);
});

statusPanel.port.on("click", function(url) {
	  require("tabs").open(url);
	});

exports.main = function() {

	widget = widgets.Widget({
		id : "jenkins-status-widget",
		label : "?",
		contentURL: data.url("blue.png"),
		panel: statusPanel
	});
	console.log("jenkins-status-monitor is running");
	
	/* set a listener on a preference change */
	prefs.on("pollingInterval", onPollingIntervalChanged);
	prefs.on("jobsUrl", onJobsUrlChanged);
	
	retrieveJenkinsStatus();
	
	startPollingTimer();
	
};
