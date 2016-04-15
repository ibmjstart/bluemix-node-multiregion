# bluemix-node-multiregion

A simple Node.js application for demonstrating multiregion applications on Bluemix using Cloudant

[![Deploy to Bluemix](https://bluemix.net/deploy/button.png)](https://bluemix.net/deploy?repository=https://github.com/ibmjstart/bluemix-node-multiregion)

If this is your first time using multiple regions on Bluemix, it is likely that you will encounter an error while the app is being deployed. If this is the case, take a look at the [Potential Problem](https://github.com/ibmjstart/bluemix-node-multiregion/blob/master/README.md#potential-problem) section. 

## After Deployment

After the app has been deployed, all three regions will work independently of one another. I encourage you to go ahead and add a few cards to each region and notice that the cards are not being shared across regions.

To set up continuous replication between the Cloudant databases located in each region we will use the [bluemix-cloudant-replicator](https://github.com/ibmjstart/bluemix-cloudant-replicator)

Once you have properly installed the bluemix-cloudant-replicator, simply run the following command:

```
cf cloudant-replicate
```

You should be guided through the process of selecting your app and the appropriate databases to replicate (postcards).

To bypass prompts you can run:

```
cf cloudant-replicate -a APP_NAME -p PASSWORD -d postcards
```

See http://www.ibm.com/developerworks/cloud/library/cl-multi-region-bluemix-apps-with-cloudant-and-dyn-trs/index.html for more information.

## Potential Problem

If you encountered an error while the app was being deployed, it is likely due to the fact that your account is not active in a region that has not yet been visited. You most likely see a screen like so:

<img src="https://github.com/ibmjstart/bluemix-node-multiregion/blob/master/README_Images/error-screen.png" align="middle"/>

If you encounter this error, click on the DASHBOARD tab from the header.

<img src="https://github.com/ibmjstart/bluemix-node-multiregion/blob/master/README_Images/dashboard-tab.png" align="middle"/> 

Once you are in your Bluemix Dashboard, click the Account and Support icon in the very top-right of the page. 

<img src="https://github.com/ibmjstart/bluemix-node-multiregion/blob/master/README_Images/account-icon.png" align="middle"/> 

A new panel should appear on the right of the screen. Click the Region section and select either of the regions that are not your default region(you will have to do both before deployment).

<img src="https://github.com/ibmjstart/bluemix-node-multiregion/blob/master/README_Images/region-select.png" align="middle"/> 

You will then be redirected to your Bluemix Dashboard for the selected region. If you have not visited the selected region before you will be prompted for a space name. For the default deployment pipeline to work, the space must be the same in each region.

<img src="https://github.com/ibmjstart/bluemix-node-multiregion/blob/master/README_Images/create-space.png" align="middle"/> 

After doing this for both unvisited regions, you can reclick the Deploy to Bluemix button and your app should now deploy correctly. 

>If you would like to delete your old project, just visit [JazzHub](https://hub.jazz.net) and delete the old project. This is not required.

This sample is provided under the [MIT license](License.txt)
