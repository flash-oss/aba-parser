# ABA parser

NPM module to parse ABA (Australian Bankers Association) files

## How to use

### Install

```shell
npm i aba-parser
```

### Usage

```typescript
const { ABA } = require("aba-parser");

const aba = new ABA();
const batches = aba.parse(abaString);
for (const { header, transactions, footer } of batches) {
  console.log(...transactions);
}
```

## Options

### Validation

Attention! Batch validation depends significantly on the default ABA structure; in order for it to function,
you must specify a minimum structure, as seen in the example below.

```typescript
const minimalBatchForValidation = {
  header: { ...otherFields },
  transaction: [{ amount: number, transactionCode: number, ...otherFields }],
  footer: {
    bsb: string, // must be 999999
    netTotal: number,
    creditTotal: number,
    debitTotal: number,
    numberOfTransactions: number,
    ...otherFileds,
  },
};
```

If you want to throw an error on an invalid batch, you need to pass options `options: {validation: true}` into the ABA
constructor for automatic batch validation.

Otherwise, you can use the manual validation method `aba.validateBatch(batch)` see examples below

### Automatic batch validation

```typescript
import { ABA } from "aba-parser";

const aba = new ABA({ validation: boolean });

try {
  const batches = aba.parse(invaidAbaString);
} catch (error) {
  console.log(error);
}
```

### Manual batch validation

You can validate batches manually without throwing an error, see the example below.

```typescript
const aba = new ABA();
const batches = aba.parse(sourceFile);
for (const batch of batches) {
  const { success, code, message } = aba.validateBatch(batch);
}
```

### Custom transaction parsing

You can add multiple custom schemas or replace default schemas to parse non-standard ABA files or those extended by a particular bank.

#### Keys description

`N` - is a string key with one character, that represents the first character in the original ABA record,
for default schemas ("0" - Descriptive Record (header), "1" - Detail Record (transaction), and "7" - File Total Record (footer))

`recordType` - a string that identifies the batch's record type.
Descriptive Record -> header; Detail Record -> transaction; File Total Record -> footer

`name` - the name of a field (amount, tax, etc.).

`boundaries` - array with 2 numbers, that specify the start and end of the field in the record string.

`type` - type of the field, provide the desired type to reformat the field.

#### Possible types:

`string` – trim spaces and return the string

`money` - convert cents to dollars and return the number.

`integer` - trim all `0` in the start and return the number

`bsb` - remove "-" and return the string

`""` – retrieve the original string

```typescript
customSchemas = {
  N: {
    recordType: "header" | "transaction" | "footer",
    fields: [
      {
        name: "string",
        boundaries: [number, number],
        type: "string" | "money" | "integer" | "bsb" | "",
      },
    ],
  },
};

const aba = new ABA({ schemas: customSchmas });
```

### Custom schema use example

```typescript
const customSchemas = {
  "5": {
    recordType: "transaction" as RecordType,
    fields: [
      { name: "transactionType", boundaries: [0, 1], type: "string" },
      { name: "bsb", boundaries: [1, 8], type: "bsb" },
      { name: "account", boundaries: [8, 17], type: "string" },
      { name: "transactionCode", boundaries: [18, 20], type: "integer" },
      { name: "amount", boundaries: [20, 30], type: "money" },
      { name: "traceBsb", boundaries: [80, 87], type: "bsb" },
      { name: "customString", boundaries: [120, 135], type: "string" },
      { name: "customInt", boundaries: [135, 140], type: "integer" },
      { name: "customBsb", boundaries: [140, 145], type: "bsb" },
      { name: "custom", boundaries: [145, 150], type: "" },
      { name: "customBsb", boundaries: [155, 160], type: "bsb" },
      { name: "customMoney", boundaries: [165, 170], type: "money" },
    ],
  },
  "6": {
    recordType: "header" as RecordType,
    fields: [
      { name: "bsb", boundaries: [1, 8], type: "bsb" },
      { name: "account", boundaries: [8, 17], type: "string" },
    ],
  },
};

const aba = new ABA({ schemas: customSchemas });

const batches = aba.parse(abaString);
for (const { header, transactions, footer } of batches) {
  console.log(...transactions);
}
```

### Default schemas

Here the list of standard schemas, you can rewrite them with custom types by using the same key

```typescript
const defaultAbaSchemas = {
  0: {
    recordType: "header",
    fields: [
      { name: "bsb", boundaries: [1, 8], type: "bsb" },
      { name: "account", boundaries: [8, 17], type: "string" },
      { name: "sequenceNumber", boundaries: [19, 20], type: "integer" },
      { name: "bank", boundaries: [20, 23], type: "string" },
      { name: "user", boundaries: [30, 56], type: "string" },
      { name: "userNumber", boundaries: [56, 62], type: "string" },
      { name: "description", boundaries: [62, 74], type: "string" },
      { name: "date", boundaries: [74, 80], type: "string" },
      { name: "time", boundaries: [80, 84], type: "string" },
    ],
  },

  1: {
    recordType: "transaction",
    fields: [
      { name: "transactionType", boundaries: [0, 1], type: "string" },
      { name: "bsb", boundaries: [1, 8], type: "bsb" },
      { name: "account", boundaries: [8, 17], type: "string" },
      { name: "tax", boundaries: [17, 18], type: "string" },
      { name: "transactionCode", boundaries: [18, 20], type: "integer" },
      { name: "amount", boundaries: [20, 30], type: "money" },
      { name: "accountTitle", boundaries: [30, 62], type: "string" },
      { name: "reference", boundaries: [62, 80], type: "string" },
      { name: "traceBsb", boundaries: [80, 87], type: "bsb" },
      { name: "traceAccount", boundaries: [87, 96], type: "string" },
      { name: "remitter", boundaries: [96, 112], type: "string" },
      { name: "taxAmount", boundaries: [112, 120], type: "money" },
    ],
  },

  7: {
    recordType: "footer",
    fields: [
      { name: "bsb", boundaries: [1, 8], type: "bsb" },
      { name: "netTotal", boundaries: [20, 30], type: "money" },
      { name: "creditTotal", boundaries: [30, 40], type: "money" },
      { name: "debitTotal", boundaries: [40, 50], type: "money" },
      { name: "numberOfTransactions", boundaries: [74, 80], type: "integer" },
    ],
  },
};
```

In the end your code can look like this

```typescript
const { ABA } = require("aba-parser");
const options = {
  validation: boolean,
  schemas: { customSchema, customSchema },
};
const aba = new ABA(options);
const batches = aba.parse(abaString);
for (const { header, transactions, footer } of batches) {
  console.log(...transactions);
}
```

## Reference information and links

### Sibling modules

[aba-generator](https://github.com/flash-oss/aba-generator) - if you need to generate an ABA string, you can use this module.

### ABA file specification

1. http://ddkonline.blogspot.com/2009/01/aba-bank-payment-file-format-australian.html
2. https://www.cemtexaba.com/aba-format/cemtex-aba-file-format-details
3. https://github.com/mjec/aba/blob/master/sample-with-comments.aba

### Standard transactions codes for ABA files

Shortcuts that are used in ABA files and what they mean

### Codes for tax in debit/credit transactions

Must be a space or the letter 'N', 'T', 'W', 'X', or 'Y'.

'N' - for new or varied BSB number or name details.
'T' - for a drawing under a Transaction Negotiation Authority.

Withholding Tax Indicators:
'W' - dividend paid to a resident of a country where a double tax agreement is in force.
'X' - dividend paid to a resident of any other country.
'Y' - interest paid to all non-residents.

Where applicable, the amount of withholding tax is to appear in character positions 113-120.
Note: Accounts of non-residents. Where withholding tax has been deducted, the appropriate Indicator as shown above, is to be used and will override the normal Indicator."

### Codes for transactionCode in debit/credit transactions

13 - "externally initiated debit"

50 - "externally initiated credit - normally what is required"

51 - "Australian government security interest"

52 - "Basic family payments/additional family payment"

53 - "Payroll payment"

54 - "Pension payment"

55 - "Allotment"

56 - "Dividend"

57 - "Debenture/note interest"
