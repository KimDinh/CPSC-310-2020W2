import * as chai from "chai";
import {expect} from "chai";
import * as fs from "fs-extra";
import * as chaiAsPromised from "chai-as-promised";
import {InsightDataset, InsightDatasetKind, InsightError} from "../src/controller/IInsightFacade";
import InsightFacade from "../src/controller/InsightFacade";
import Log from "../src/Util";
import TestUtil from "./TestUtil";
import {NotFoundError} from "restify";

// This extends chai with assertions that natively support Promises
chai.use(chaiAsPromised);

// This should match the schema given to TestUtil.validate(..) in TestUtil.readTestQueries(..)
// except 'filename' which is injected when the file is read.
export interface ITestQuery {
    title: string;
    query: any; // make any to allow testing structurally invalid queries
    isQueryValid: boolean;
    result: any;
    filename: string; // This is injected when reading the file
}

describe("InsightFacade Add/Remove/List Dataset", function () {
    // Reference any datasets you've added to test/data here and they will
    // automatically be loaded in the 'before' hook.
    const datasetsToLoad: { [id: string]: string } = {
        courses: "./test/data/courses.zip",
        courses1: "./test/data/courses1.zip", // copy of courses, valid
        courses2: "./test/data/courses2.zip", // empty folder, invalid
        courses3: "./test/data/courses3.zip", // folder contains a file that is not JSON, invalid
        courses4: "./test/data/courses4.zip", // folder contains only an empty JSON file, invalid
        courses5: "./test/data/courses5.zip", // folder contains a JSON file that has a JSON array, invalid
        courses6: "./test/data/courses6.txt", // not a zip file, invalid
        courses7: "./test/data/courses7.zip", // no courses folder, invalid
        courses8: "./test/data/courses8.zip", // 1 valid JSON file, 1 invalid png file, dataset valid
        courses9: "./test/data/courses9.zip", // folder contains 1 valid JSON file, valid
        courses10: "./test/data/courses10.zip", // folder contains 1 valid JSON, 1 invalid JSON, valid
        courses11: "./test/data/courses11.zip", // folder contains 1 valid JSON file, 1 folder, valid
        courses12: "./test/data/courses12.zip", // folder contains only 1 folder, invalid
        rooms: "./test/data/rooms.zip", // folder named room, invalid
    };
    let datasets: { [id: string]: string } = {};
    let insightFacade: InsightFacade;
    const cacheDir = __dirname + "/../data";

    before(function () {
        // This section runs once and loads all datasets specified in the datasetsToLoad object
        // into the datasets object
        Log.test(`Before all`);
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir);
        }
        for (const id of Object.keys(datasetsToLoad)) {
            datasets[id] = fs
                .readFileSync(datasetsToLoad[id])
                .toString("base64");
        }
        try {
            insightFacade = new InsightFacade();
        } catch (err) {
            Log.error(err);
        }
    });

    beforeEach(function () {
        Log.test(`BeforeTest: ${this.currentTest.title}`);
    });

    after(function () {
        Log.test(`After: ${this.test.parent.title}`);
    });

    afterEach(function () {
        // This section resets the data directory (removing any cached data) and resets the InsightFacade instance
        // This runs after each test, which should make each test independent from the previous one
        Log.test(`AfterTest: ${this.currentTest.title}`);
        try {
            fs.removeSync(cacheDir);
            fs.mkdirSync(cacheDir);
            insightFacade = new InsightFacade();
        } catch (err) {
            Log.error(err);
        }
    });

    // This is a unit test. You should create more like this!
    it("Should add a valid dataset", function () {
        const id: string = "courses";
        const expected: string[] = [id];
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.eventually.deep.equal(expected);
    });

    it("Should not add a dataset of kind Room", function () {
        const id: string = "rooms";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Rooms,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should not add a dataset whose folder is not named 'courses'", function () {
        const id: string = "rooms";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should not add a dataset that is already added", function () {
        const id: string = "courses";
        const expectedAddResult: string[] = [id];
        let addResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(addResult).to.eventually.deep.equal(expectedAddResult).then(() => {
            addResult = insightFacade.addDataset(
                id,
                datasets[id],
                InsightDatasetKind.Courses,
            );
            return expect(addResult).to.be.rejectedWith(InsightError);
        });
    });

    it("Should not add a dataset that is an empty folder", function () {
        const id: string = "courses2";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should not add a dataset containing a file that is not JSON", function () {
        const id: string = "courses3";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should not add a dataset containing only an empty JSON file", function () {
        const id: string = "courses4";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should not add a dataset containing a JSON file that has a JSON array", function () {
        const id: string = "courses5";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should not add a dataset that is not a zip file", function () {
        const id: string = "courses6";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should not add a dataset that does not have 'courses' folder", function () {
        const id: string = "courses7";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should add a dataset containing 1 valid file, 1 invalid file", function () {
        const id: string = "courses8";
        const expected: string[] = [id];
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.eventually.deep.equal(expected);
    });

    it("Should add a dataset that contains only 1 valid JSON file", function () {
        const id: string = "courses9";
        const expected: string[] = [id];
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.eventually.deep.equal(expected);
    });

    it("Should add a dataset that contains 1 valid JSON file, 1 invalid JSON file", function () {
        const id: string = "courses10";
        const expected: string[] = [id];
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.eventually.deep.equal(expected);
    });

    it("Should add a dataset that contains 1 valid JSON file, 1 folder", function () {
        const id: string = "courses11";
        const expected: string[] = [id];
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.eventually.deep.equal(expected);
    });

    it("Should not add a dataset whose folder contains only another folder", function () {
        const id: string = "courses12";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should not add a dataset whose id does not exist", function () {
        const id: string = "courses100";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should not add a dataset with id that contains underscore", function () {
        const id: string = "courses_1";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should not add a dataset whose id is only whitespace characters", function () {
        const id: string = "  ";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should not add a dataset whose id is null", function () {
        const id: string = null;
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should not add a null dataset", function () {
        const id: string = "courses";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            null,
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should not add a dataset whose kind is null", function () {
        const id: string = "courses";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            null,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should not add a dataset whose id is undefined", function () {
        const id: string = undefined;
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should not add an undefined dataset", function () {
        const id: string = "courses";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            undefined,
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should not add a dataset whose kind is undefined", function () {
        const id: string = "courses";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            undefined,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should add two datasets, remove the first dataset, list the second dataset", function () {
        const id: string = "courses";
        const id1: string = "courses1";
        let expectedAddResult: string[] = [id];
        let addResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(addResult)
            .to.eventually.deep.equal(expectedAddResult)
            .then(() => {
                expectedAddResult = [id, id1];
                addResult = insightFacade.addDataset(
                    id1,
                    datasets[id1],
                    InsightDatasetKind.Courses,
                );
                return expect(addResult)
                    .to.eventually.deep.equal(expectedAddResult)
                    .then(() => {
                        const removeResult: Promise<
                            string
                            > = insightFacade.removeDataset(id);
                        return expect(removeResult)
                            .to.eventually.deep.equal(id)
                            .then(() => {
                                const listResult: Promise<
                                    InsightDataset[]
                                    > = insightFacade.listDatasets();
                                const expectedListResult: InsightDataset[] = [
                                    {
                                        id: id1,
                                        kind: InsightDatasetKind.Courses,
                                        numRows: 64612,
                                    },
                                ];
                                return expect(
                                    listResult,
                                ).to.eventually.deep.equal(expectedListResult);
                            });
                    });
            });
    });

    it("Should add two datasets, remove the second dataset, list the first dataset", function () {
        const id: string = "courses";
        const id1: string = "courses1";
        let expectedAddResult: string[] = [id];
        let addResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(addResult)
            .to.eventually.deep.equal(expectedAddResult)
            .then(() => {
                expectedAddResult = [id, id1];
                addResult = insightFacade.addDataset(
                    id1,
                    datasets[id1],
                    InsightDatasetKind.Courses,
                );
                return expect(addResult)
                    .to.eventually.deep.equal(expectedAddResult)
                    .then(() => {
                        const removeResult: Promise<
                            string
                            > = insightFacade.removeDataset(id1);
                        return expect(removeResult)
                            .to.eventually.deep.equal(id1)
                            .then(() => {
                                const listResult: Promise<
                                    InsightDataset[]
                                    > = insightFacade.listDatasets();
                                const expectedListResult: InsightDataset[] = [
                                    {
                                        id: id,
                                        kind: InsightDatasetKind.Courses,
                                        numRows: 64612,
                                    },
                                ];
                                return expect(
                                    listResult,
                                ).to.eventually.deep.equal(expectedListResult);
                            });
                    });
            });
    });

    it("Should not remove a dataset not added, no dataset in insightFacade", function () {
        const id: string = "courses";
        const futureResult: Promise<string> = insightFacade.removeDataset(id);
        return expect(futureResult).to.be.rejectedWith(NotFoundError);
    });

    it("Should not remove a dataset not added, a dataset exists in insightFacade", function () {
        const id: string = "courses";
        const id1: string = "courses1";
        let expectedAddResult: string[] = [id];
        let addResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(addResult)
            .to.eventually.deep.equal(expectedAddResult)
            .then(() => {
                const removeResult: Promise<string> = insightFacade.removeDataset(id1);
                return expect(removeResult).to.be.rejectedWith(NotFoundError);
            });
    });

    it("Should not remove a dataset whose id contains underscore", function () {
        const id: string = "courses_1";
        const futureResult: Promise<string> = insightFacade.removeDataset(id);
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should not remove a dataset whose id is only whitespace characters", function () {
        const id: string = "  ";
        const futureResult: Promise<string> = insightFacade.removeDataset(id);
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should not remove a dataset whose id is null", function () {
        const id: string = null;
        const futureResult: Promise<string> = insightFacade.removeDataset(id);
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should not remove a dataset whose id is undefined", function () {
        const id: string = undefined;
        const futureResult: Promise<string> = insightFacade.removeDataset(id);
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should list no datasets", function () {
        const futureResult: Promise<
            InsightDataset[]
            > = insightFacade.listDatasets();
        const expected: InsightDataset[] = [];
        return expect(futureResult).to.eventually.deep.equal(expected);
    });

    it("Should a dataset, list one dataset", function () {
        const id: string = "courses";
        const expectedAddResult: string[] = [id];
        const addResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(addResult)
            .to.eventually.deep.equal(expectedAddResult)
            .then(() => {
                const listResult: Promise<
                    InsightDataset[]
                    > = insightFacade.listDatasets();
                const expectedListResult: InsightDataset[] = [
                    {
                        id: "courses",
                        kind: InsightDatasetKind.Courses,
                        numRows: 64612,
                    },
                ];
                return expect(listResult).to.eventually.deep.equal(
                    expectedListResult,
                );
            });
    });

    it("Should add two datasets, list two datasets", function () {
        const id: string = "courses";
        const id1: string = "courses1";
        let expectedAddResult: string[] = [id];
        let addResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(addResult)
            .to.eventually.deep.equal(expectedAddResult)
            .then(() => {
                expectedAddResult = [id, id1];
                addResult = insightFacade.addDataset(
                    id1,
                    datasets[id1],
                    InsightDatasetKind.Courses,
                );
                return expect(addResult)
                    .to.eventually.deep.equal(expectedAddResult)
                    .then(() => {
                        const listResult: Promise<
                            InsightDataset[]
                            > = insightFacade.listDatasets();
                        const expectedListResult: InsightDataset[] = [
                            {
                                id: "courses",
                                kind: InsightDatasetKind.Courses,
                                numRows: 64612,
                            },
                            {
                                id: "courses1",
                                kind: InsightDatasetKind.Courses,
                                numRows: 64612,
                            },
                        ];
                        return expect(listResult).to.eventually.deep.equal(
                            expectedListResult,
                        );
                    });
            });
    });
});

/*
 * This test suite dynamically generates tests from the JSON files in test/queries.
 * You should not need to modify it; instead, add additional files to the queries directory.
 * You can still make tests the normal way, this is just a convenient tool for a majority of queries.
 */
describe("InsightFacade PerformQuery", () => {
    const datasetsToQuery: {
        [id: string]: { path: string; kind: InsightDatasetKind };
    } = {
        courses: {
            path: "./test/data/courses.zip",
            kind: InsightDatasetKind.Courses,
        },
    };
    let insightFacade: InsightFacade;
    let testQueries: ITestQuery[] = [];

    // Load all the test queries, and call addDataset on the insightFacade instance for all the datasets
    before(function () {
        Log.test(`Before: ${this.test.parent.title}`);

        // Load the query JSON files under test/queries.
        // Fail if there is a problem reading ANY query.
        try {
            testQueries = TestUtil.readTestQueries();
        } catch (err) {
            expect.fail(
                "",
                "",
                `Failed to read one or more test queries. ${err}`,
            );
        }

        // Load the datasets specified in datasetsToQuery and add them to InsightFacade.
        // Will fail* if there is a problem reading ANY dataset.
        const loadDatasetPromises: Array<Promise<string[]>> = [];
        insightFacade = new InsightFacade();
        for (const id of Object.keys(datasetsToQuery)) {
            const ds = datasetsToQuery[id];
            const data = fs.readFileSync(ds.path).toString("base64");
            loadDatasetPromises.push(
                insightFacade.addDataset(id, data, ds.kind),
            );
        }
        return Promise.all(loadDatasetPromises).catch((err) => {
            /* *IMPORTANT NOTE: This catch is to let this run even without the implemented addDataset,
             * for the purposes of seeing all your tests run.
             * TODO For C1, remove this catch block (but keep the Promise.all)
             */
            return Promise.resolve("HACK TO LET QUERIES RUN");
        });
    });

    beforeEach(function () {
        Log.test(`BeforeTest: ${this.currentTest.title}`);
    });

    after(function () {
        Log.test(`After: ${this.test.parent.title}`);
    });

    afterEach(function () {
        Log.test(`AfterTest: ${this.currentTest.title}`);
    });

    // Dynamically create and run a test for each query in testQueries
    // Creates an extra "test" called "Should run test queries" as a byproduct. Don't worry about it
    it("Should run test queries", function () {
        describe("Dynamic InsightFacade PerformQuery tests", function () {
            for (const test of testQueries) {
                it(`[${test.filename}] ${test.title}`, function () {
                    const futureResult: Promise<
                        any[]
                        > = insightFacade.performQuery(test.query);
                    return TestUtil.verifyQueryResult(futureResult, test);
                });
            }
        });
    });
});

// This test generates tests from the JSON files in test/smalltest.
// These tests query on fake datasets (already processed) in /data
describe("Testing query on fake datasets", () => {
    let insightFacade: InsightFacade;
    let testQueries: ITestQuery[] = [];

    // Load all the test queries
    before(function () {
        Log.test(`Before: ${this.test.parent.title}`);

        // Load the query JSON files under test/queries.
        // Fail if there is a problem reading ANY query.
        try {
            testQueries = TestUtil.readTestQueries("test/smalltest");
        } catch (err) {
            expect.fail(
                "",
                "",
                `Failed to read one or more test queries. ${err}`,
            );
        }
        insightFacade = new InsightFacade();
    });

    beforeEach(function () {
        Log.test(`BeforeTest: ${this.currentTest.title}`);
    });

    after(function () {
        Log.test(`After: ${this.test.parent.title}`);
    });

    afterEach(function () {
        Log.test(`AfterTest: ${this.currentTest.title}`);
    });

    // Dynamically create and run a test for each query in testQueries
    // Creates an extra "test" called "Should run test queries" as a byproduct. Don't worry about it
    it("Should run test queries", function () {
        describe("PerformQuery tests", function () {
            for (const test of testQueries) {
                it(`[${test.filename}] ${test.title}`, function () {
                    const futureResult: Promise<
                        any[]
                        > = insightFacade.performQuery(test.query);
                    return TestUtil.verifyQueryResult(futureResult, test);
                });
            }
        });
    });
});
