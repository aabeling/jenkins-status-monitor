const widgets = require("widget");
var Request = require("request").Request;
var timers = require("timers");
var notifications = require("notifications");
var prefs = require("simple-prefs");

var widget = null;
var lastUnstableJobs = new Array();
var pollingTimerId = null;

function isJobUnstable(job)
{
  /* job is unstable if color does not begin with 'blue' */
  return (job.color.substring(0,4) != "blue");
}

function retrieveJenkinsStatus() 
{
	
	var url = prefs.prefs.jobsUrl + "?" +new Date().getTime();
	console.log("retrieving jobs from url: " + url);
	
	Request({
		/* make the url unique to prevent caching */
		url : url,
		onComplete : function(response) {

			/* check if the response is parseable as json */
			if (response.json == null) {
				console.log("response: " + response.text);
				console.log("failed to parse response as json");
				widget.content = "error";
				return;
			}

			/* get the jobs array */
			var jobs = response.json.jobs;

			/* filter out unstable jobs */
			var unstableJobs = new Array();
			for (i in jobs) {
				if ( isJobUnstable(jobs[i]) ) {
					console.log("job is unstable: " + jobs[i].name);
					unstableJobs.push(jobs[i]);
				}
			}

			if ( unstableJobs.length == 0 ) {
				/* jenkins is stable */
				console.log("no unstable jobs found");
				widget.content = "blue";
				widget.label = "jenkins is stable";
				widget.tooltip = "no unstable jobs";
				if ( lastUnstableJobs.length > 0 ) {
					/* notify about the stability */
					lastUnstableJobs = new Array();
					notifications.notify({
						  title: "jenkins is stable again",
						  text: "A hail to code-repair-man!"
						});
				}
			} else {
				console.log("unstableJobs: " + unstableJobs);
				widget.content = "red";
				widget.label = "jenkins is unstable";
	
				/* if the list of unstable jobs changed create a notification */
				if ( lastUnstableJobs.length != unstableJobs.length ) {
					var notificationText = "";
					for (i in unstableJobs) {
						notificationText += unstableJobs[i].name + "<br/>";
					}
					widget.tooltip = notificationText;
					lastUnstableJobs = unstableJobs;
					notifications.notify({
						  title: "jenkins is unstable",
						  text: notificationText
						});
				}
			}
		}
	}).get();
}

function onPollingIntervalChanged(prefName)
{
	console.log("polling interval changed to " + prefs.prefs.pollingInterval);
	startPollingTimer();
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

exports.main = function() {

	widget = widgets.Widget({
		id : "jenkins-status-widget",
		label : "?",
		content : "blue",
		width : 50,
		onClick : function() {
			retrieveJenkinsStatus();
		}
	});
	console.log("jenkins-status-monitor is running");
	
	/* set a listener on a preference change */
	prefs.on("pollingInterval", onPollingIntervalChanged);
	
	startPollingTimer();
};
