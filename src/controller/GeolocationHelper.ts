import Log from "../Util";
import {IInsightFacade, InsightDataset, InsightDatasetKind, ResultTooLargeError} from "./IInsightFacade";
import {InsightError, NotFoundError} from "./IInsightFacade";
import {QueryHelper} from "./QueryHelper";
import {DatasetHelper} from "./DatasetHelper";
import * as fs from "fs-extra";
import {Dataset, SectionKeys} from "./Dataset";
import * as JSZip from "jszip";
import {TransformationHelper} from "./TransformationHelper";

export class GeolocationHelper {

    public static getLatLon(buildingObject: any): Promise<any> {
        const httplink = "http://cs310.students.cs.ubc.ca:11316/api/v1/project_team158/";
        const httpFull = httplink + encodeURIComponent(buildingObject.address);
        const http = require("http");
        try {
            http.get(httpFull, (res: any) => {
                const {statusCode} = res;
                const contentType = res.headers["content-type"];

                let error;
                // Any 2xx status code signals a successful response but
                // here we're only checking for 200.
                if (statusCode !== 200) {
                    error = new Error("Request Failed.\n" +
                        `Status Code: ${statusCode}`);
                } else if (!/^application\/json/.test(contentType)) {
                    error = new Error("Invalid content-type.\n" +
                        `Expected application/json but received ${contentType}`);
                }
                if (error) {
                    // Consume response data to free up memory
                    res.resume();
                    return;
                }

                res.setEncoding("utf8");
                let rawData = "";
                res.on("data", (chunk: any) => {
                    rawData += chunk;
                });
                res.on("end", () => {
                    try {
                        const parsedData = JSON.parse(rawData);
                        if (parsedData.error) {
                            return Promise.reject();
                        } else {
                            buildingObject.lat = parsedData.lat;
                            buildingObject.lon = parsedData.lon;
                            return Promise.resolve();
                        }
                    } catch (e) {
                        return Promise.reject();
                    }
                });
            }).on("error", (e: any) => {
                return Promise.reject();
            });
        } catch (e) {
            return Promise.reject();
        }
    }
}
