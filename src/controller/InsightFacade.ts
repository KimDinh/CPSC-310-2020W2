import Log from "../Util";
import {IInsightFacade, InsightDataset, InsightDatasetKind, ResultTooLargeError} from "./IInsightFacade";
import {InsightError, NotFoundError} from "./IInsightFacade";
import {Section} from "./Section";
import * as JSZip from "jszip";
import {QueryHelper} from "./QueryHelper";
import * as fs from "fs-extra";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */

export default class InsightFacade implements IInsightFacade {
    public static readonly MAXQUERYRESULTS: number = 5000;

    constructor() {
        Log.trace("InsightFacadeImpl::init()");
    }

    public addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
        return new Promise<any[]>((resolve, reject) => {
            let newZip = new JSZip();
            return newZip.loadAsync(content, {base64: true})
                .then((zip) => {
                    // Code help from documentation and StackOverflow
                    // https://stuk.github.io/jszip/documentation/api_jszip/load_async.html
                    // https://stackoverflow.com/questions/39322964/extracting-zipped-files-using-jszip-in-javascript
                    const currentDataset = [
                        {
                            id: id,
                            kind: kind,
                            numRows: 64612,
                        },
                    ];
                    let sectionsPromise: Array<Promise<string>> = [];
                    const course = zip.folder("courses");
                    course.forEach((relativePath, file) => {
                        sectionsPromise.push(file.async("text"));
                    });
                    return Promise.all(sectionsPromise).then(function (sectionsArray) {
                        sectionsArray.forEach((file) => {
                            let course1 = JSON.parse(file);
                            course1.result.forEach((section: any) => {
                                // get the necessary info
                            });
                        });
                    });
                    // I don't know what sections contains
                    // Object.keys(zip.files).forEach(function (filename) {
                    //     zip.files[filename].async("string").then(function (fileData) {
                    //         // zip.file("sample.txt").async("string");
                    //         let section = JSON.parse(fileData);
                    //         for (const info of section) {
                    //             const department = info.Subject;
                    //         }
                    //         sections.push(section);
                    //         // let sections: any[] = JSON.parse(fs.readFileSync(fileData)
                    //         //     .toString("base64"));
                    //     });
                    // });
                });

            try {
                // TODO: perform WHERE
                // TODO: perform OPTIONS
            } catch (e) {
                // InsightError or ResultTooLargeError caught
                reject(e);
            }
        });
        // return Promise.reject("Not implemented.");
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
            return Promise.reject(new InsightError(("Missing or invalid OPTIONS in query")));
        }
        // if query contains keys other than WHERE and OPTIONS
        if (Object.keys(query).length > 2) {
            return Promise.reject(new InsightError("Redundant keys in query"));
        }
        try {
            const id: string = QueryHelper.getId(query);
            let sections: any[] = JSON.parse(fs.readFileSync("/data/" + id + ".json")
                .toString("base64"));
            let booleanFilter: boolean[];
            if (Object.keys(query["WHERE"]).length === 0) {
                // empty WHERE matches all sections
                booleanFilter = sections.map(() => true);
            } else {
                booleanFilter = QueryHelper.processFilter(id, query["WHERE"], sections);
            }
            // query result size is larger than MAXQUERYRESULTS
            if (booleanFilter.filter(Boolean).length > InsightFacade.MAXQUERYRESULTS) {
                throw new ResultTooLargeError();
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
