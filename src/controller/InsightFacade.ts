import Log from "../Util";
import {IInsightFacade, InsightDataset, InsightDatasetKind} from "./IInsightFacade";
import {InsightError, NotFoundError} from "./IInsightFacade";
import * as JSZip from "jszip";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {

    constructor() {
        Log.trace("InsightFacadeImpl::init()");
    }

    public addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
        return new Promise<any[]>((resolve, reject) => {
            let newZip = new JSZip();
            return newZip.loadAsync(content, {base64: true})
                .then(function (zip) {
                    // Code help from documentation
                    // https://stuk.github.io/jszip/documentation/api_jszip/load_async.html
                    zip.loadAsync("string")
                        .then(function (zip1) {
                            Object.keys(zip1.files).forEach(function (filename) {
                                zip.files[filename].async("string").then(function (fileData) {
                                    zip.file("sample.txt").async("string");
                                });
                            });
                        });
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
        return new Promise<any[]>((resolve, reject) => {
            // if query does not contain WHERE or query["WHERE"] is null or undefined
            if (!("WHERE" in query) ||  query["WHERE"] === null || query["WHERE"] === undefined) {
                return reject(new InsightError("Missing 'WHERE' in query"));
            }
            // if query does not contain OPTIONS or query["OPTIONS"] is null or undefined
            if (!("OPTIONS" in query) || !query["OPTIONS"] === null || !query["OPTIONS"] === undefined) {
                return reject(new InsightError(("Missing 'OPTIONS' in query")));
            }
            // if query contains keys other than WHERE and OPTIONS
            if (Object.keys(query).length > 2) {
                return reject(new InsightError("Redundant keys in query"));
            }
            // TODO: check if ids in query refer to the same and existing dataset
            try {
                // TODO: perform WHERE
                // TODO: perform OPTIONS
            } catch (e) {
                // InsightError or ResultTooLargeError caught
                reject(e);
            }
        });
    }

    public listDatasets(): Promise<InsightDataset[]> {
        return Promise.reject("Not implemented.");
    }
}
