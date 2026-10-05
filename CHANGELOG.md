# Changelog

## [Unreleased]

### Fixed

- STK prompts now use Buy Goods till 4277642. Paybill-style requests were rejected by Safaricom with result code 2029.

### Added

- Pay page that sends an M-Pesa STK prompt for a Safaricom number and amount.
- Callback receiver and STK query fallback that record paid, cancelled, timed out, and failed results.
- Admin sign-in and dashboard for every payment, including the full phone number and M-Pesa receipt.
