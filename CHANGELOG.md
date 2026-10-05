# Changelog

## [Unreleased]

### Fixed

- STK prompts now use Buy Goods till 4277642. Paybill-style requests were rejected by Safaricom with result code 2029.
- A successful Safaricom callback now marks the payment paid and stores the receipt. The pay page checks again when the customer returns from the PIN screen.

### Removed

- The admin name column. Safaricom does not send a customer name with these payments.

### Added
- Pay page that sends an M-Pesa STK prompt for a Safaricom number and amount.
- Callback receiver and STK query fallback that record paid, cancelled, timed out, and failed results.
- Admin sign-in and dashboard for every payment, including the full phone number and M-Pesa receipt.
