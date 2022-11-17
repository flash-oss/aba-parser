# ABA parser

Parse ABA (Australian Bankers Association) files

## How to use

### Install

```shell
npm i aba-parser
```

### Usage

```javascript
const { ABA } = require("aba-parser");
const aba = new ABA();
const batches = aba.parse(abaString);
for (const { header, transactions, footer } of batches) {
    console.log(...transactions);
}
```

## Codes for tax in debit/credit transactions

Must be a space or the letter 'N', 'T', 'W', 'X', or 'Y'.

'N' - for new or varied BSB number or name details.
'T' - for a drawing under a Transaction Negotiation Authority.

Withholding Tax Indicators:
'W' - dividend paid to a resident of a country where a double tax agreement is in force.
'X' - dividend paid to a resident of any other country.
'Y' - interest paid to all non-residents.

Where applicable, the amount of withholding tax is to appear in character positions 113-120.
Note: Accounts of non-residents. Where withholding tax has been deducted, the appropriate Indicator as shown above, is to be used and will override the normal Indicator."

## Codes for transactionCode in debit/credit transactions

13 - "externally initiated debit" // DEBIT
50 - "externally initiated credit - normally what is required" // CREDIT
51 - "Australian government security interest"
52 - "Basic family payments/additional family payment"
53 - "Payroll payment" // PAYMENT
54 - "Pension payment"
55 - "Allotment"
56 - "Dividend"
57 - "Debenture/note interest"
