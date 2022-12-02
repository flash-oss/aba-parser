import assert from "assert";
import test from "node:test";
import { ABA, RecordType } from "../lib";
import * as fs from "fs";

const abaExample =
    "0123-456 12341234 01BQL       MY NAME                   1111111004231633  230410                                        \n" +
    "1123-456157108231Y530000001234S R SMITH                       TEST BATCH        062-000 12223123MY ACCOUNT      00001200\n" +
    "1123-783 12312312 530000002200J K MATTHEWS                    TEST BATCH        062-000 12223123MY ACCOUNT      00000030\n" +
    "1456-789   125123 530003123513P R JONES                       TEST BATCH        062-000 12223123MY ACCOUNT      00000000\n" +
    "1121-232    11422 530000002300S M ASLIN                       TEST BATCH        062-000 12223123MY ACCOUNT      00000000\n" +
    "7999-999            000312924700031292470000000000                        000004                                        ";
test("index tests", async (t) => {
    await t.test("should successfully parse ABA string", () => {
        const aba = new ABA();

        const batches = aba.parse(abaExample);

        assert.deepStrictEqual(batches[0].header, {
            bsb: "123456",
            account: "12341234",
            sequenceNumber: 1,
            bank: "BQL",
            user: "MY NAME",
            userNumber: "111111",
            description: "1004231633",
            date: "230410",
            time: "",
        });
        assert.strictEqual(batches[0].transactions.length, 4);
        assert.deepStrictEqual(batches[0].transactions[0], {
            bsb: "123456",
            account: "157108231",
            tax: "Y",
            transactionCode: 53,
            amount: 12.34,
            accountTitle: "S R SMITH",
            reference: "TEST BATCH",
            traceBsb: "062000",
            traceAccount: "12223123",
            remitter: "MY ACCOUNT",
            taxAmount: 12,
            transactionType: "1",
        });
        assert.deepStrictEqual(batches[0].footer, {
            bsb: "999999",
            netTotal: 31292.47,
            creditTotal: 31292.47,
            debitTotal: 0,
            numberOfTransactions: 4,
        });
    });

    await t.test("should open file, read it and pass validation", function () {
        const sourceFile = fs.readFileSync("./test/ABA-files/aba_test.file", "utf8");

        const aba = new ABA();

        const batches = aba.parse(sourceFile);
        for (const batch of batches) {
            const validationResult = aba.validateBatch(batch);
            assert.strictEqual(validationResult.success, true);
        }
    });

    await t.test("should open file, read it and don't throw error", function () {
        const sourceFile = fs.readFileSync("./test/ABA-files/aba_test.file", "utf8");

        const aba = new ABA({ validation: true });

        try {
            aba.parse(sourceFile);
        } catch (error) {
            assert.strictEqual("", "should never invoke");
        }
    });

    await t.test("should return bad batch without forced validation and throw error on validation: true", function () {
        const badNumberOfTransactions = abaExample.replace("000004", "000001");

        let aba = new ABA();

        const batches = aba.parse(badNumberOfTransactions);
        assert.strictEqual(batches.length, 1);

        aba = new ABA({ validation: true });

        try {
            aba.parse(badNumberOfTransactions);
            assert.strictEqual("", "should never invoke");
        } catch (error) {
            assert.strictEqual(
                error.message,
                "Invalid batch, batch ended on line: 6, message: Total transactions count mismatch"
            );
        }

        const badBsb = abaExample.replace("999-999", "987-999");

        try {
            aba.parse(badBsb);
            assert.strictEqual("", "should never invoke");
        } catch (error) {
            assert.strictEqual(
                error.message,
                "Invalid batch, batch ended on line: 6, message: Footer bsb must be always 999999"
            );
        }

        const badCreditTotal = abaExample.replaceAll("3129247", "3129246");

        try {
            aba.parse(badCreditTotal);
            assert.strictEqual("", "should never invoke");
        } catch (error) {
            assert.strictEqual(
                error.message,
                "Invalid batch, batch ended on line: 6, message: Batch creditTotal mismatch"
            );
        }

        const badDebitTotal = abaExample.replace("0000000000", "0000000001");

        try {
            aba.parse(badDebitTotal);
            assert.strictEqual("", "should never invoke");
        } catch (error) {
            assert.strictEqual(
                error.message,
                "Invalid batch, batch ended on line: 6, message: Batch debitTotal mismatch"
            );
        }
    });

    await t.test("should find and parse custom fields", function () {
        const customAbaFile =
            "0123-456 12341234 01BQL       MY NAME                   1111111004231633  230410                                        \n" +
            "5123-456157108231Y530000001234S R SMITH                       TEST BATCH        062-000 12223123MY ACCOUNT      00001200   customString  0012345 999-999 01-2   12001\n" +
            "7999-999            000312924700031292470000000000                        000001                                        ";
        const customSchemas = {
            "5": {
                recordType: "transaction" as RecordType,
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
                    { name: "taxAmount", boundaries: [112, 120], type: "string" },
                    { name: "customString", boundaries: [120, 135], type: "string" },
                    { name: "customInt", boundaries: [137, 144], type: "integer" },
                    { name: "customBsb", boundaries: [145, 152], type: "bsb" },
                    { name: "custom", boundaries: [152, 159], type: "" },
                    { name: "customMoney", boundaries: [159, 169], type: "money" },
                ],
            },
        };

        const aba = new ABA({ schemas: customSchemas });

        const batches = aba.parse(customAbaFile);
        assert.strictEqual(batches[0].transactions[0].customString, "customString");
        assert.strictEqual(batches[0].transactions[0].customInt, 12345);
        assert.strictEqual(batches[0].transactions[0].customBsb, "999999");
        assert.strictEqual(batches[0].transactions[0].custom, " 01-2  ");
        assert.strictEqual(batches[0].transactions[0].customMoney, 120.01);
    });
});
