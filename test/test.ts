import assert from "assert";
import test from "node:test";
import { ABA } from "../lib";

test("index tests", (t) => {
    t.test("should successfully parse ABA string", () => {
        const abaExample =
            "0123-456 12341234 01BQL       MY NAME                   1111111004231633  230410                                        \n" +
            "1123-456157108231Y530000001234S R SMITH                       TEST BATCH        062-000 12223123MY ACCOUNT      00001200\n" +
            "1123-783 12312312 530000002200J K MATTHEWS                    TEST BATCH        062-000 12223123MY ACCOUNT      00000030\n" +
            "1456-789   125123 530003123513P R JONES                       TEST BATCH        062-000 12223123MY ACCOUNT      00000000\n" +
            "1121-232    11422 530000002300S MASLIN                        TEST BATCH        062-000 12223123MY ACCOUNT      00000000\n" +
            "7999-999            000312924700031292470000000000                        000004                                        ";
        const aba = new ABA();

        const result = aba.parse(abaExample);

        assert.deepStrictEqual(result[0].header, {
            bsb: "123456",
            account: "12341234",
            sequenceNumber: 1,
            bank: "BQL",
            user: "MY NAME",
            userNumber: 111111,
            description: "1004231633",
            date: "230410",
            time: "    ",
        });
        assert.strictEqual(result[0].transactions.length, 4);
        assert.deepStrictEqual(result[0].transactions[0], {
            bsb: "123456",
            account: "157108231",
            tax: "Y",
            transactionCode: 53,
            amount: 12.34,
            accountTitle: "S R SMITH",
            reference: "TEST BATCH",
            traceBSB: "062000",
            traceAccount: "12223123",
            remitter: "MY ACCOUNT",
            taxAmount: 12,
            transactionType: 1,
        });
        assert.deepStrictEqual(result[0].footer, {
            bsb: "999999",
            netTotal: 31292.47,
            creditTotal: 31292.47,
            debitTotal: 0,
            numberOfTransactions: 4,
        });
    });
});
