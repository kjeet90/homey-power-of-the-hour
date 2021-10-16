The 'Power of the hour' is a device for warning about high power consumption.

The main purpose of this app is to be able to keep the hourly consumption below a certain limit of e.g. 5000Wh

You can get notified about several different power situations
- When your consumption is getting above a set limit within a configurable time window.
- When your predicted consumption is getting above a set limit within a configurable time window.
- When your predicted consumption drops below a configured limit after the predictor trigger has been activated.
- When you get a new consumption peak
- When a new hour starts (warnings are reset).

You can enable and disable the consumption warning triggers in the 'Advanced settings' of the device.
The 'Power of the hour' predictor can be configured to use either x amount of historic readings or x minutes old readings.

To install the device:

1. Add the ‘Power of the hour’ device.
2. Go to ‘Settings‘ and select what to display in the status indicator.
3. Go to ‘Advanced settings’ and adjust the limits and warnings.


Example of use:

Goal: Keep the consumption below 5000Wh

1. Configure 'Power of the hour' device with the following limits
    - Consumption limit: 4500Wh between 0 and 60 minutes
    - Prediction limit: 5000Wh between 30 and 60 minutes
    - Reset prediction limit: 3500Wh
    - All warnings enabled
2. Create four flows
    - When: 'Consumption limit reached', Then: Turn all heating off (Full ECO mode)
    - When: 'Prediction limit reached', Then: Reduce heating to keep below consumption limit (ECO mode)
    - When: 'Prediction limit reset', Then: Turn all heating on again (Comfort mode)
    - When: 'New hour', Then: Turn all heaters on again, since it's a new hour (Comfort mode)