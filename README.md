# Power of the hour

The **Power of the hour** is a device for notifying about high power consumption.

The main purpose of this app is to be able to keep the hourly consumption below a certain limit of e.g. 5000Wh

You can get notified about several different power situations

- When your actual consumption is getting above a set limit within a decided time window.
- When your predicted consumption is getting above a set limit within a configurable time window.
- When your predicted consumption drops below a configured limit after the prediction trigger has been activated.
- When your actual and predicted notification are reset on a new hour (requires them to already be activated).
- When you get a new consumption peak.
- When a new hour starts (notifications are also reset if active).

You can enable and disable the consumption notifications triggers in the 'Advanced settings' of the device.
The **Power of the hour** predictor can be configured to use either x amount of historic readings or x minutes old readings.

## Get started:

1. Install the app
2. Add a ‘Power of the hour’ device from the app.
3. Go to ‘Settings‘ and select what to display in the status indicator.
4. Go to ‘Advanced settings’ and adjust the trigger limits and notifications.
5. Create required flows

## Example of use:

Goal: Keep the consumption below 5000Wh

1. Configure a **Power of the hour** device with the following limits
   - Consumption limit (Wh): 4500Wh between 0 and 60 minutes
   - Prediction limit (Wh): 5000Wh between 30 and 60 minutes
   - Reset below (Wh): 3500Wh
   - All notifications enabled
2. Create five flows
   - **When**: Consumption changes on a device, **Then**: _'Update consumption'_ with the consumption
   - **When**: _'Prediction notification trigged'_, **Then**: Reduce heating to keep below consumption limit
   - **When**: _'Consumption notification trigged'_, **Then**: Turn heating off
   - **When**: _'Prediction notification reset'_, **Then**: Turn heating up again
   - **When**: _'Consumption notification reset'_, **Then**: Turn heating on again

# Release notes:

## 1.0.0

### Added

- Action flow card: Set new consumption limit
- Action flow card: Set new prediction limit
- Action flow card: Set new 'Reset below' limit
- Action flow card: Reset all values
- Condition flow card: Consumption limit is above
- Condition flow card: Prediction limit is above
- Condition flow card: 'Reset below' limit is above
- Insight for consumption of previous hour
- Insight for this hours peak
- Persistent values. Restarting app/Homey will no longer wipe data if started again within same hour.

### Changed

- Application README to be easier to understand for the end user.
- Units from Wt to Wh for Norwegian language.

## 0.2.0

### Added

- Timeline for trigger/reset of prediction and consumption notifications.
- Trigger flow card: Consumption notification reset.
- Condition flow card: Consumption notification trigged.
- Condition flow card: Prediction notification trigged.

### Changed

- Names, descriptions and hints of flow cards and settings to be more descriptive.

### Fixed

- Issue where reset prediction would reset even with setting disabled.
