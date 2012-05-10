This is the jenkins-status-monitor add-on.

To test it you need the add-on sdk (https://addons.mozilla.org/de/developers/builder).
If the sdk is installed you can test the plugin with a bold

$ cfx run

This will test the plugin with a jobs list defined in the plugin resources.
If you want to test the plugin with your own jobs list I recommend to create
a profile folder somewhere and start cfx pointing to this folder:
$ cfx run -P profile

During development I tested the plugin with a static jobs file. If you use a profile
the jobs url will be stored when the test firefox is closed and will be available
on the next startup.

The plugin can be installed from the AMO at
https://addons.mozilla.org/de/firefox/addon/jenkins-status-monitor/

