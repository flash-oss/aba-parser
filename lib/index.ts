function stringToInt(string): number {
    return parseInt(string) || 0;
}

function centsToDollars(string): number {
    return stringToInt(string) / 100;
}

export class ABA {
    parseDescriptiveRecord(line: string) {
        return {
            bsb: line.substring(1, 8).replace("-", "").trim(),
            account: line.substring(8, 17).trim(),
            sequenceNumber: stringToInt(line.substring(18, 20)),
            bank: line.substring(20, 23),
            user: line.substring(30, 56).trim(),
            userNumber: stringToInt(line.substring(56, 62)),
            description: line.substring(62, 74).trim(),
            date: line.substring(74, 80), // DDMMYY
            time: line.substr(80, 4), // HHmm
        };
    }

    parseDetailRecord(line: string) {
        return {
            transactionType: stringToInt(line.substring(0, 1)),
            bsb: line.substring(1, 8).replace("-", ""), // The third party account BSB
            account: line.substring(8, 17).trim(), // The third party account number
            tax: line.substring(17, 18), // tax codes, N,T,W,X,Y," "
            transactionCode: stringToInt(line.substring(18, 20)),
            amount: centsToDollars(line.substring(20, 30)),
            accountTitle: line.substring(30, 62).trim(), // The third party account name.
            reference: line.substring(62, 80).trim(),
            traceBSB: line.substring(80, 87).replace("-", ""),
            traceAccount: line.substring(87, 96).trim(),
            remitter: line.substring(96, 112).trim(),
            taxAmount: centsToDollars(line.substring(112, 120)),
        };
    }

    parseFinalTotalRecord(line: string) {
        return {
            bsb: line.substring(1, 8).replace("-", ""), // must be 999999
            netTotal: centsToDollars(line.substring(20, 30)),
            creditTotal: centsToDollars(line.substring(30, 40)),
            debitTotal: centsToDollars(line.substring(40, 50)),
            numberOfTransactions: stringToInt(line.substring(74, 80)),
        };
    }

    parse(content: string): Batch[] {
        // split ABA into lines
        const batches = [];
        const lineArray = content.split(/\r?\n/);
        let header;
        let transactions = [];

        for (const line of lineArray) {
            if (line[0] === "0") {
                // Descriptive Record (header)
                header = this.parseDescriptiveRecord(line);
            }

            if (line[0] === "1") {
                // Detail Record (transactions) for Direct Debit/Credit
                transactions.push(this.parseDetailRecord(line));
            }

            if (line[0] === "7") {
                //File Total Record (footer)
                const footer = this.parseFinalTotalRecord(line);
                batches.push({ header, transactions: [...transactions], footer });
                header = undefined;
                transactions = [];
            }

            // We ignore all the other lines in the file.
        }

        return batches;
    }
}

interface Header {
    bsb?: string; // Main account BSB. Should be ignored according to the specs.
    account?: string; // Main account number. Up to 9 chars. Should be ignored according to the specs.
    sequenceNumber: number; // Sequence number of file in batch (starting from 01), ABA file contain 500 tx max
    bank: string; // Name of financial institution processing this file. 3 characters, like "ANZ", "WBC"
    user: string; // How the user will be shown in the transactions of the third party banks.
    userNumber: number; // The ID of the user supplying the file.
    description: string; // Description of this file entries. Up to 12 chars.
    date: string; // Date to be processed.
    time: string; // Time to be processed. Should be ignored according to the specs.
}

// Direct Credit / Direct Debit transaction
interface Transaction {
    transactionType: 1; // can be only 1
    bsb: string; // The third party account BSB
    tax: string; // see README for more info
    transactionCode: number; // Debit or credit? ABA.CREDIT or ABA.DEBIT
    account: string; // The third party account number
    amount: number;
    accountTitle: string; // The third party (recipient) account name. Up to 32 chars.
    reference: string; // Payment reference, e.g. "Invoice # 123". Up to 18 chars.
    traceBsb: string; // The transacting account BSB
    traceAccount: string; // The transacting account number
    remitter: string; // The transacting company name.
    taxAmount: number;
}

interface Footer {
    bsb: string; // must be 999999
    netTotal: number;
    creditTotal: number;
    debitTotal: number;
    numberOfTransactions: number;
}

interface Batch {
    header: Header;
    transactions: Transaction[];
    footer: Footer;
}
