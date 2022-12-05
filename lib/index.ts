const defaultAbaSchemas = {
    "0": {
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
    "1": {
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

    "7": {
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

function stringToInt(string: string): number {
    return parseInt(string) || 0;
}

function stringToBSB(string: string): string {
    return string.replace("-", "").trim();
}

function centsToDollars(string: string): number {
    return stringToInt(string) / 100;
}

function trim(string: string): string {
    return string.trim();
}

function reformatFieldType(line: string, field: { type: string; boundaries: number[]; name: string }) {
    const rawData = line.substring(field.boundaries[0], field.boundaries[1]);
    if (field.type === "string") {
        return trim(rawData);
    }
    if (field.type === "money") {
        return centsToDollars(rawData);
    }
    if (field.type === "integer") {
        return stringToInt(rawData);
    }
    if (field.type === "bsb") {
        return stringToBSB(rawData);
    }
    return rawData;
}

export class ABA {
    // hold all ABA schemas
    public schemas: object = { ...defaultAbaSchemas };
    readonly validate: boolean;

    /**
     * Specify custom ABA schemas and automatic validation.
     * Your batch must comply with the basic structural requirements to use validation; for more information, check the README or validateBatch method.
     * @param options {validate: boolean}
     * @param options {schemas: {customSchemas}}
     */
    constructor(options?: ParserOptions) {
        this.schemas = Object.assign(this.schemas, options?.schemas);
        this.validate = options?.validation;
    }

    // Parse any provided lines with schemas
    private _parseLine(line: string, recordSchema) {
        const parseResult = {};
        for (const field of recordSchema.fields) {
            parseResult[field.name] = reformatFieldType(line, field);
        }
        return parseResult;
    }

    /**
     * Validate one Batch
     * The bare minimum structure needed to validate a Batch
     *  param Batch: {header: {}, transactions: [{amount, transactionCode}], footer: {bsb, netTotal, creditTotal, debitTotal, numberOfTransactions}}
     * @return {success: boolean, message: string, code: string}
     */
    validateBatch(batch: Batch): { success: boolean; message: string; code: string } {
        const fail = (message: string, code?: undefined) => ({
            success: false,
            message,
            code: code || "INVALID_BATCH",
        });
        const { transactions, footer } = batch;
        if (footer.bsb !== "999999") {
            return fail("Footer bsb must be always 999999");
        }
        if (transactions.length !== footer.numberOfTransactions) {
            return fail("Total transactions count mismatch");
        }
        let creditTotal = 0,
            debitTotal = 0;
        for (const transaction of transactions) {
            // 13 mean DEBIT
            if (transaction.transactionCode === 13) {
                debitTotal += transaction.amount || 0;
            } else {
                creditTotal += transaction.amount || 0;
            }
        }
        if (creditTotal !== footer.creditTotal) {
            return fail("Batch creditTotal mismatch");
        }
        if (debitTotal !== footer.debitTotal) {
            return fail("Batch debitTotal mismatch");
        }
        return { success: true, code: "VALID_BATCH", message: "Batch looks valid" };
    }

    /**
     * Parse ABA
     * @param content {String} ABA string
     * @return {{header, transactions[], footer}[]} Array of Batches
     */
    parse(content: string): Batch[] {
        // split ABA into lines
        const batches = [];
        const lines = content.split(/\r?\n/);
        let header;
        let transactions = [];

        for (const line of lines) {
            const recordSchema = this.schemas[line[0]];
            if (!recordSchema) {
                continue;
            }

            const parsedLine = this._parseLine(line, recordSchema);
            if (recordSchema.recordType === "header") {
                // Descriptive Record (header)
                header = parsedLine;
                continue;
            }
            if (recordSchema.recordType === "transaction") {
                // Detail Record (transactions) for Direct Debit/Credit
                transactions.push(parsedLine);
                continue;
            }
            if (recordSchema.recordType === "footer") {
                //File Total Record (footer)
                const footer = parsedLine;
                const batch = { header, transactions: [...transactions], footer };
                if (this.validate) {
                    const validationResult = this.validateBatch(batch);
                    if (!validationResult.success) {
                        throw new Error(
                            `Invalid batch, batch ended on line: ${lines.indexOf(line) + 1}, message: ${
                                validationResult.message
                            }`
                        );
                    }
                }
                batches.push(batch);
                header = undefined;
                transactions = [];
            }
        }

        return batches;
    }
}

export type RecordTypeNumber = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

export interface ParserOptions {
    validation?: boolean;
    schemas?: { [key in RecordTypeNumber]?: RecordSchema };
}

export type RecordType = "header" | "transaction" | "footer";

export interface RecordSchema {
    recordType: RecordType;
    fields: { name: string; boundaries: number[]; type: string }[];
}

// Descriptive Record
interface Header {
    bsb?: string; // Main account BSB. Should be ignored according to the specs.
    account?: string; // Main account number. Up to 9 chars. Should be ignored according to the specs.
    sequenceNumber?: number; // Sequence number of file in batch (starting from 01), ABA file contain 500 tx max
    bank?: string; // Name of financial institution processing this file. 3 characters, like "ANZ", "WBC"
    user?: string; // How the user will be shown in the transactions of the third party banks.
    userNumber?: string; // The ID of the user supplying the file.
    description?: string; // Description of this file entries. Up to 12 chars.
    date?: Date | string | number; // Date to be processed.
    time?: Date | string | number; // Time to be processed. Should be ignored according to the specs.
    // for custom fields
    [x: string]: string | number | Date;
}

// Direct Credit / Direct Debit transaction
interface Transaction {
    transactionType?: string;
    bsb?: string; // The third party account BSB
    tax?: "N" | "W" | "X" | "Y" | " " | ""; // see README for more info
    transactionCode?: number; // Debit or credit... see README for more info
    account?: string; // The third party account number
    amount?: number;
    accountTitle?: string; // The third party (recipient) account name. Up to 32 chars.
    reference?: string; // Payment reference, e.g. "Invoice # 123". Up to 18 chars.
    traceBsb?: string; // The transacting account BSB
    traceAccount?: string; // The transacting account number
    remitter?: string; // The transacting company name.
    taxAmount?: number;
    // for custom fields
    [x: string]: string | number | Date;
}

// File Total Record

interface Footer {
    bsb?: string; // must be 999999
    netTotal?: number;
    creditTotal?: number;
    debitTotal?: number;
    numberOfTransactions?: number;
    // for custom fields
    [x: string]: string | number | Date;
}

interface Batch {
    header: Header;
    transactions: Transaction[];
    footer: Footer;
}
