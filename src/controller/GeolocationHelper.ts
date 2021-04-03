import {InsightError, NotFoundError} from "./IInsightFacade";

// http code taken from https://nodejs.org/api/http.html#http_http_get_options_callback
// as per suggestion of TAs and other students on Piazza with minor adaptation
// such as returning a promise since get is async as per TA answer on Piazza
export class GeolocationHelper {

    public static getLatLon(buildingInfo: any): Promise<any> {
        return new Promise(function (resolve, reject) {
            const httpLink = "http://cs310.students.cs.ubc.ca:11316/api/v1/project_team158/";
            const httpFull = httpLink + encodeURIComponent(buildingInfo.address);
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
                                resolve (buildingInfo);
                                // reject (new InsightError("Cannot get geolocation"));
                                // throw new InsightError("Cannot get geolocation");
                            } else {
                                buildingInfo.lat = parsedData.lat;
                                buildingInfo.lon = parsedData.lon;
                                resolve (buildingInfo);
                            }
                        } catch (e) {
                            resolve (buildingInfo);
                            // reject (new InsightError("Parse error"));
                            // throw new InsightError();
                        }
                    });
                });
                // }).on("error", (e: any) => {
                //     return Promise.reject(e);
                //     // throw new InsightError();
                // });
            } catch (e) {
                resolve (buildingInfo);
                // reject (new InsightError("HTTP Get failed"));
                // throw new InsightError();
            }
        });
    }
}
