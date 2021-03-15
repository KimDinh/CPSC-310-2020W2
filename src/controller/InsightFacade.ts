import Log from "../Util";
import {IInsightFacade, InsightDataset, InsightDatasetKind, ResultTooLargeError} from "./IInsightFacade";
import {InsightError, NotFoundError} from "./IInsightFacade";
import {QueryHelper} from "./QueryHelper";
import {DatasetHelper} from "./DatasetHelper";
import * as fs from "fs-extra";
import {Dataset, SectionKeys} from "./Dataset";
import * as JSZip from "jszip";
import {TransformationHelper} from "./TransformationHelper";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */

// interface Test {
//     [key: string]: any;
// }
// const test: Test = {
//     dept: "hello",
//     4: 1
// }
export default class InsightFacade implements IInsightFacade {
    public static readonly MAXQUERYRESULTS: number = 5000;

    constructor() {
        Log.trace("InsightFacadeImpl::init()");
    }

    public addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
        if (!DatasetHelper.checkValidId(id, true)) {
            return Promise.reject(new InsightError("Invalid dataset id"));
        }
        if (!DatasetHelper.checkValidZip(content)) {
            return Promise.reject(new InsightError("Invalid dataset zip"));
        }
        if (!DatasetHelper.checkValidKind(kind)) {
            return Promise.reject(new InsightError("Invalid dataset kind"));
        }
        let newZip = new JSZip();
        return newZip.loadAsync(content, {base64: true})
            .then((zip) => {
                if (kind === InsightDatasetKind.Rooms) {
                    return this.addRooms(zip, id, kind);
                } else {
                    return this.addCourses(zip, id, kind);
                }
            }).catch((error) => Promise.reject(new InsightError("Invalid zip file")));
    }

    private addRooms(zip: JSZip, id: string, kind: InsightDatasetKind.Rooms): Promise<any> {
        let roomsArray: any[];
        let datasetObject: object;
        if (!DatasetHelper.checkValidRoomsFolder(zip)) {
            return Promise.reject(new InsightError("Rooms folder does not exist"));
        }
        const rooms = zip.folder("rooms");
        if (!DatasetHelper.checkValidIndextHTM(rooms)) {
            return Promise.reject(new InsightError("Invalid index.htm file"));
        }
        try {
            return new Promise(function (resolve, reject) {
                rooms.file("index.htm").async("string").then((indexHtm: string) => {
                    DatasetHelper.getBuildings(zip, indexHtm, id, kind).then((buildings) => {
                        roomsArray = buildings;
                        if (!roomsArray.length) {
                            reject(new InsightError("No valid rooms in dataset"));
                        }
                        datasetObject = DatasetHelper.formDatasetObject(roomsArray, id, kind);
                        let datasetObjectString = JSON.stringify(datasetObject);
                        const dataDir: string = __dirname + "/../../data";
                        if (!fs.existsSync(dataDir)) {
                            fs.mkdirsSync(dataDir);
                        }
                        fs.writeFileSync(dataDir + "/" + id + ".json", datasetObjectString, "utf8");
                        let allCurDatasets: Promise<string[]> = DatasetHelper.getAllCurDatasets(dataDir);
                        resolve(allCurDatasets);
                    }).catch();
                }).catch();
            });
        } catch (e) {
            return Promise.reject(e);
        }
    }

    private addCourses(zip: JSZip, id: string, kind: InsightDatasetKind.Courses) {
        // Code help from documentation and StackOverflow
        // https://stuk.github.io/jszip/documentation/api_jszip/load_async.html
        // https://stackoverflow.com/questions/39322964/extracting-zipped-files-using-jszip-in-javascript
        try {
            let sections: object[] = [];
            let datasetObject: object;
            let sectionsPromise: any[] = [];
            if (!DatasetHelper.checkValidCoursesFolder(zip)) {
                return Promise.reject(new InsightError("Courses folder does not exist"));
            }
            const courses = zip.folder("courses");
            courses.forEach((relativePath, file) => {
                sectionsPromise.push(file.async("string"));
            });
            return Promise.all(sectionsPromise).then((sectionsArray: string[]) => {
                sections = DatasetHelper.addSections(sectionsArray, id, kind);
                if (!sections.length) {
                    return Promise.reject(new InsightError("No valid sections in dataset"));
                }
                datasetObject = DatasetHelper.formDatasetObject(sections, id, kind);
                let datasetObjectString = JSON.stringify(datasetObject);
                const dataDir: string = __dirname + "/../../data";
                if (!fs.existsSync(dataDir)) {
                    fs.mkdirsSync(dataDir);
                }
                fs.writeFileSync(dataDir + "/" + id + ".json", datasetObjectString, "utf8");
                let allCurDatasets: Promise<string[]> = DatasetHelper.getAllCurDatasets(dataDir);
                return Promise.resolve(allCurDatasets);
            });
        } catch (e) {
            return Promise.reject(e);
        }
    }

    public removeDataset(id: string): Promise<string> {
        const dataDir: string = __dirname + "/../../data/" + id + ".json";
        if (!DatasetHelper.checkValidId(id, false)) {
            return Promise.reject(new InsightError("Invalid dataset id"));
        }
        if (!(fs.existsSync(dataDir))) {
            return Promise.reject(new NotFoundError());
        }
        try {
            fs.unlinkSync(dataDir);
            return Promise.resolve(id);
        } catch (e) {
            return Promise.reject(e);
        }
    }

    public performQuery(query: any): Promise<any[]> {
        if (query === undefined || query === null) {
            return Promise.reject(new InsightError("Query is null or undefined"));
        }
        if (!QueryHelper.checkValidWhere(query)) {
            return Promise.reject(new InsightError("Missing or invalid WHERE in query"));
        }
        if (!QueryHelper.checkValidOptions(query)) {
            return Promise.reject(new InsightError("Missing or invalid OPTIONS in query"));
        }
        if (!TransformationHelper.checkValidTransformation(query)) {
            return Promise.reject(new InsightError("Invalid TRANSFORMATION in query"));
        }
        if (Object.keys(query).length > 3 ||
            (Object.keys(query).length === 3 && !Object.keys(query).includes("TRANSFORMATION"))) {
            return Promise.reject(new InsightError("Redundant keys in query"));
        }
        try {
            const id: string = QueryHelper.getId(query);
            const dataset = JSON.parse(fs.readFileSync("data/" + id + ".json", "utf8"));
            let sections: any[] = dataset.data;
            const kind = dataset.kind;
            let booleanFilter: boolean[];
            if (Object.keys(query["WHERE"]).length === 0) {
                // empty WHERE matches all sections
                booleanFilter = sections.map(() => true);
            } else {
                booleanFilter = QueryHelper.processFilter(id, kind, query["WHERE"], sections);
            }
            // remove the sections that do not satisfy the filter
            sections = sections.filter((section, index) => booleanFilter[index]);
            if (query.hasOwnProperty("TRANSFORMATION")) {
                const transformResult =
                    TransformationHelper.processTransform(id, kind, query["TRANSFORMATION"], sections);
                sections = TransformationHelper.processOptionsTransform(id, kind, query["OPTIONS"],
                    query["TRANSFORMATION"], transformResult);
            } else {
                if (sections.length > InsightFacade.MAXQUERYRESULTS) {
                    return Promise.reject(new ResultTooLargeError());
                }
                sections = QueryHelper.processOptions(id, kind, query["OPTIONS"], sections);
            }
            if (sections.length > InsightFacade.MAXQUERYRESULTS) {
                throw new ResultTooLargeError();
            }
            return Promise.resolve(sections);
        } catch (e) {
            return Promise.reject(e);
        }
    }

    public listDatasets(): Promise<InsightDataset[]> {
        let datasets: InsightDataset[] = [];
        let dataset: InsightDataset;
        const dataDir: string = __dirname + "/../../data/";
        try {
            let datasetsRaw = fs.readdirSync(dataDir);

            datasetsRaw.forEach( function (datasetRaw) {
                let sectionKind: {"data": any, "kind": InsightDatasetKind, "rows": number} =
                    JSON.parse(fs.readFileSync(dataDir + datasetRaw, "utf8"));
                // let dataset = new InsightDataset(datasetRaw, sectionKind[1], sectionKind[2]);
                dataset = {
                    id: datasetRaw.split(".")[0],
                    kind: sectionKind.kind,
                    numRows: sectionKind.rows
                };
                datasets.push(dataset);
            });
            return Promise.resolve(datasets);
        } catch (e) {
            return Promise.resolve(datasets);
        }
    }
}
