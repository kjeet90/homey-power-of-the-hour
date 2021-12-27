Power of the hour can predict what your total energy consumption will be at the end of the hour and notify you if the predictions or the actual consumptions are getting above your preferred limits.

Example of overview of consumption from a smart energy meter:

1. Install the app
2. Add a 'Power of the hour' (POTH) device from the app
3. Create a flow to update the POTH with consumption from the meter:
    When: Consumption changes on the meter
    Then: 'Update consumption' on POTH with the consumption.


Configure to your needs:

- Go to ‘Settings‘ and select what to display in the status indicator.
- Go to ‘Advanced settings’ and adjust the trigger limits and notifications.
- Create flows to turn on/off consumers with the different trigger cards.

Example of use:

Goal: Keep the consumption below 5000Wh

1. Configure device: 'Power of the hour':
    - Consumption limit (Wh): 4500Wh between 0 and 60 minutes.
    - Prediction limit (Wh): 5000Wh between 30 and 60 minutes.
    - Reset below (Wh): 3500Wh.
    - All notifications enabled.
2. Create five flows:
    - When: Consumption changes
      Then: 'Update consumption'
    - When: 'Prediction notification trigged'
      Then: Reduce heating
    - When: 'Consumption notification trigged'
      Then: Turn heating off
    - When: 'Prediction notification reset',
      Then: Turn heating up again
    - When: 'Consumption notification reset'
      Then: Turn heating on again