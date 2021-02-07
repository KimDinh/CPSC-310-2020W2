import Log from "../Util";
import {IInsightFacade, InsightDataset, InsightDatasetKind, ResultTooLargeError} from "./IInsightFacade";
import {InsightError, NotFoundError} from "./IInsightFacade";
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
        return Promise.reject("Not implemented.");
    }

    public removeDataset(id: string): Promise<string> {
        return Promise.reject("Not implemented.");
    }

    public performQuery(query: any): Promise<any[]> {
        return new Promise<any[]>((resolve, reject) => {
            // if query does not contain WHERE or query["WHERE"] is invalid
            if (!QueryHelper.checkValidWhere(query)) {
                return reject(new InsightError("Missing or invalid WHERE in query"));
            }
            // if query does not contain OPTIONS or query["OPTIONS"] is invalid
            if (!QueryHelper.checkValidOptions(query)) {
                return reject(new InsightError(("Missing or invalid OPTIONS in query")));
            }
            // if query contains keys other than WHERE and OPTIONS
            if (Object.keys(query).length > 2) {
                return reject(new InsightError("Redundant keys in query"));
            }
            try {
                const id: string = QueryHelper.getId(query);
                let sections: any[] = JSON.parse(fs.readFileSync("./data" + id).toString("base64"));
                let booleanFilter: boolean[];
                if (Object.keys(query["WHERE"]).length === 0) {
                    // empty WHERE matches all sections
                    booleanFilter = sections.map(() => true);
                } else {
                    booleanFilter = QueryHelper.processFilter(id, query["WHERE"], sections);
                }
                // query result size is larger than MAXQUERYRESULTS
                if (booleanFilter.filter(Boolean).length > InsightFacade.MAXQUERYRESULTS) {
                    throw new ResultTooLargeError("Query result exceeds " + InsightFacade.MAXQUERYRESULTS.toString());
                }
                // remove the sections that do not satisfy the filter
                sections = sections.filter((section, index) => booleanFilter[index]);
                // choose columns and possibly sort the sections
                sections = QueryHelper.processOptions(id, query["OPTIONS"], sections);
                return resolve(sections);
            } catch (e) {
                reject(e);
            }
        });
    }

    public listDatasets(): Promise<InsightDataset[]> {
        return Promise.reject("Not implemented.");
    }
}
