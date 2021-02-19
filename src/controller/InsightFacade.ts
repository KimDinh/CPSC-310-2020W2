import Log from "../Util";
import {IInsightFacade, InsightDataset, InsightDatasetKind, ResultTooLargeError} from "./IInsightFacade";
import {InsightError, NotFoundError} from "./IInsightFacade";
import {QueryHelper} from "./QueryHelper";
import {DatasetHelper} from "./DatasetHelper";
import * as fs from "fs-extra";
import {Dataset, SectionKeys} from "./Dataset";
import * as JSZip from "jszip";

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
        if (!DatasetHelper.checkValidId(id)) {
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
                // Code help from documentation and StackOverflow
                // https://stuk.github.io/jszip/documentation/api_jszip/load_async.html
                // https://stackoverflow.com/questions/39322964/extracting-zipped-files-using-jszip-in-javascript
                try {
                    let sections: object[] = [];
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
                        let sectionString = JSON.stringify(sections);
                        const currentDataset =  new Dataset(id, kind, sections);
                        if (sectionString) {
                            const dataDir: string = __dirname + "/../../data";
                            if (!fs.existsSync(dataDir)) {
                                fs.mkdirsSync(dataDir);
                            }
                            fs.writeFileSync(dataDir + "/" + id + ".json", sectionString, "utf8");
                            return Promise.resolve([id]);
                        } else {
                            return Promise.reject(new InsightError("Invalid dataset"));
                        }
                    });
                } catch (e) {
                    return Promise.reject(e);
                }
            });
    }

    public removeDataset(id: string): Promise<string> {
        return Promise.reject("Not implemented.");
    }

    public performQuery(query: any): Promise<any[]> {
        if (query === undefined || query === null) {
            return Promise.reject(new InsightError("Query is null or undefined"));
        }
        // if query does not contain WHERE or query["WHERE"] is invalid
        if (!QueryHelper.checkValidWhere(query)) {
            return Promise.reject(new InsightError("Missing or invalid WHERE in query"));
        }
        // if query does not contain OPTIONS or query["OPTIONS"] is invalid
        if (!QueryHelper.checkValidOptions(query)) {
            Log.trace("here");
            return Promise.reject(new InsightError(("Missing or invalid OPTIONS in query")));
        }
        // if query contains keys other than WHERE and OPTIONS
        if (Object.keys(query).length > 2) {
            return Promise.reject(new InsightError("Redundant keys in query"));
        }
        try {
            const id: string = QueryHelper.getId(query);
            let sections: any[] = JSON.parse(fs.readFileSync("data/" + id + ".json", "utf8"));
            let booleanFilter: boolean[];
            if (Object.keys(query["WHERE"]).length === 0) {
                // empty WHERE matches all sections
                booleanFilter = sections.map(() => true);
            } else {
                booleanFilter = QueryHelper.processFilter(id, query["WHERE"], sections);
            }
            // query result size is larger than MAXQUERYRESULTS
            if (booleanFilter.filter(Boolean).length > InsightFacade.MAXQUERYRESULTS) {
                return Promise.reject(new ResultTooLargeError());
            }
            // remove the sections that do not satisfy the filter
            sections = sections.filter((section, index) => booleanFilter[index]);
            // choose columns and possibly sort the sections
            sections = QueryHelper.processOptions(id, query["OPTIONS"], sections);
            // add id to the keys in query result
            for (const section of sections) {
                for (const key in section) {
                    const newKey: string = id + "_" + key;
                    section[newKey] = section[key];
                    delete section[key];
                }
            }
            return Promise.resolve(sections);
        } catch (e) {
            return Promise.reject(e);
        }
    }

    public listDatasets(): Promise<InsightDataset[]> {
        return Promise.reject("Not implemented.");
    }
}
