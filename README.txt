Power of the hour can predict what your total energy consumption will be at the end of the hour and notify you if the predictions or the actual consumptions are getting above your preferred limits.

Get started:

1. Install the app
2. Add one or more ‘Power of the hour’ device from the app.
3. Go to ‘Settings‘ and select what to display in the status indicator.
4. Go to ‘Advanced settings’ and adjust the trigger limits and notifications.
5. Create flows (Examples below)

Example of use:

Goal: Keep the consumption below 5000Wh

1. Configure a 'Power of the hour' device with the following limits:
    - Consumption limit (Wh): 4500Wh between 0 and 60 minutes.
    - Prediction limit (Wh): 5000Wh between 30 and 60 minutes.
    - Reset below (Wh): 3500Wh.
    - All notifications enabled.
2. Create five flows:
    - When: Consumption changes on a device, Then: 'Update consumption' with the consumption
    - When: 'Prediction notification trigged', Then: Reduce heating to keep below consumption limit
    - When: 'Consumption notification trigged', Then: Turn heating off
    - When: 'Prediction notification reset', Then: Turn heating up again
    - When: 'Consumption notification reset', Then: Turn heating on again