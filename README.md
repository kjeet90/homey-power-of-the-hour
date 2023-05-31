# Power of the hour

## What is it?

A Homey app for staying within your preferred consumption and/or cost limits one hour at a time.

## How do I get started?

Read the guide on the [Github wiki](https://github.com/kjeet90/homey-power-of-the-hour/wiki). That should contain everything you need to know.

# Release notes:

## 1.3.4

-   Code improvements. Added tests.

## 1.3.3

### Upgrade

-   Changed from JavaScript to TypeScript and from Jest to Vitest

## 1.3.2

### Bugfix

-   Fixed issue where Homey Pro (Early 2023) would not list any devices

### Upgrade

-   Updated dependencies

## 1.3.1

### Bugfix

-   Fixed issue where transition to new hour sometimes reported too low consumption/price.
-   Fixed incorrect reference to flow card on 'Notify reset on new hour' setting.

## 1.3.0

### Added

-   Power available to consumption and predicted consumption limit is reached.
    -   Two new trigger cards for when these values changes.
    -   As long as your consumption stays below these values, you should not exceed the limits.

## 1.2.2

### Bugfix

-   Fixed issue where it could crash on startup.

## 1.2.1

### Bugfix

-   Fixed issue where it would crash on a few occations.

### Upgrade

-   Upgraded to use node 16.15.0

## 1.2.0

### Added

-   Support for updating consumption with both W and kW
-   Support for negative values in case user delivers back to the grid.

## 1.1.0

### Added

-   Predicted and actual cost with same type of flow-cards as consumption

## 1.0.0

### Added

-   Action flow card: Set new consumption limit
-   Action flow card: Set new prediction limit
-   Action flow card: Set new 'Reset below' limit
-   Action flow card: Reset all values
-   Condition flow card: Consumption limit is above
-   Condition flow card: Prediction limit is above
-   Condition flow card: 'Reset below' limit is above
-   Insight for consumption of previous hour
-   Insight for this hours peak
-   Persistent values. Restarting app/Homey will no longer wipe data if started again within same hour.

### Changed

-   Application README to be easier to understand for the end user.
-   Units from Wt to Wh for Norwegian language.

## 0.2.0

### Added

-   Timeline for trigger/reset of prediction and consumption notifications.
-   Trigger flow card: Consumption notification reset.
-   Condition flow card: Consumption notification trigged.
-   Condition flow card: Prediction notification trigged.

### Changed

-   Names, descriptions and hints of flow cards and settings to be more descriptive.

### Fixed

-   Issue where reset prediction would reset even with setting disabled.
