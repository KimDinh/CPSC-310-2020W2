import {InsightDatasetKind, InsightError} from "./IInsightFacade";
import * as fs from "fs-extra";
import {Dataset, RoomKeys, SectionKeys} from "./Dataset";
import * as JSZip from "jszip";
import {GeolocationHelper} from "./GeolocationHelper";
const parse5 = require("parse5");

export class DatasetHelper {
    // return true if id does not contain underscore, is not undefined, is not null, or is not only whitespaces
    // or the dataset already exists (for add)
    public static checkValidId(id: any, add: boolean): boolean {
        if (id === undefined || id === null) {
            return false;
        } else if (!(typeof id === "string")) {
            return false;
        } else if (id.includes("_") || !id.trim().length) {
            return false;
        } else if (fs.existsSync(__dirname + "/../../data/" + id + ".json") && add) {
            return false;
        } else {
            return true;
        }
    }

    // return true if kind is not Room or is not null or is not undefined
    public static checkValidKind(kind: any): boolean {
        if (kind === null || kind === undefined) {
            return false;
        } else {
            return true;
        }
    }

    // return true if zip is not undefined or is not null
    public static checkValidZip(zip: any): boolean {
        if (zip === undefined || zip === null) {
            return false;
        } else {
            return true;
        }
    }

    public static addSections(sectionsArray: any, id: any, kind: any): any[] {
        let sections: object[] = [];
        sectionsArray.forEach((file: any) => {
            let sectionsRaw;
            try {
                sectionsRaw = JSON.parse(file);
                sectionsRaw.result.forEach((sectionRaw: any) => {
                    let section: { [key in SectionKeys]?: any } = {
                        [SectionKeys.Department]: sectionRaw.Subject,
                        [SectionKeys.Id]: sectionRaw.Course,
                        [SectionKeys.Instructor]: sectionRaw.Professor,
                        [SectionKeys.Title]: sectionRaw.Title,
                        [SectionKeys.Uuid]: sectionRaw.id.toString(),
                        [SectionKeys.Average]: sectionRaw.Avg,
                        [SectionKeys.Pass]: sectionRaw.Pass,
                        [SectionKeys.Fail]: sectionRaw.Fail,
                        [SectionKeys.Audit]: sectionRaw.Audit,
                        [SectionKeys.Year]: sectionRaw.Section === "overall" ? 1900 : parseInt(sectionRaw.Year, 10)
                    };
                    sections.push(section);
                });
            } catch (e) {// do nothing
            }
        });
        return sections;
    }

    // Code help from
    // https://stackoverflow.com/questions/39939644/jszip-checking-if-a-zip-folder-contains-a-specific-file
    // return true if "courses" folder exist in the zip file
    public static checkValidCoursesFolder(zip: JSZip): boolean {
        if (zip.folder(/courses/).length > 0) {
            return true;
        } else {
            return false;
        }
    }

    public static formDatasetObject(sections: object[], id: string, kind: InsightDatasetKind): any {
        let retVal = {
                data: sections,
                kind: kind,
                rows: sections.length
            };
        return retVal;
    }

    public static getAllCurDatasets(dataDir: string): string[] {
        let allCurDatasetIds: string[] = [];
        let datasetsRaw = fs.readdirSync(dataDir);
        datasetsRaw.forEach( function (datasetRaw) {
            allCurDatasetIds.push(datasetRaw.split(".")[0]);
        });
        return allCurDatasetIds;
    }

    public static parseHTML(htmlString: string): Promise<any> {
        try {
            return Promise.resolve(parse5.parse(htmlString));
        } catch (e) {
            return Promise.reject(e);
        }
    }

    public static getBuildings(zip: JSZip, content: string): Promise<object[]> {
        try {
           const parsedIndexHTM = parse5.parse(content);
           let table = this.findTableBody(parsedIndexHTM);
           if (table === null) {
               return Promise.reject("Table does not exist");
           } else {
               // let buildings: string[] = this.findBuilding(zip, table);
               // return Promise.resolve(buildings);
               return DatasetHelper.findBuilding(zip, table).then((roomsArray: object[]) => {
                   return roomsArray;
               }).catch((error) => {
                   return Promise.reject(error);
               });
           }
        } catch (e) {
            return Promise.reject(e);
        }
    }

    public static checkValidRoomsFolder(zip: JSZip): boolean {
        if (zip.folder(/rooms/).length > 0) {
            return true;
        } else {
            return false;
        }
    }

    public static checkValidIndextHTM(rooms: JSZip): boolean {
        if (rooms.file("index.htm")) {
            return true;
        } else {
            return false;
        }
    }

    // Code help from https://www.youtube.com/watch?v=pL7-618Vlq8&ab_channel=NoaHeyl
    public static findBuilding(zip: JSZip, tableBody: any): Promise<object[]> {
        let rooms: object[] = [];
        let roomsPromise: any[] = [];
        const buildingInfo = {shortname: "", href: "", fullname: "", address: "", lat: 0, lon: 0};
        const buildingCode = "views-field views-field-field-building-code";
        const buildingAddress = "views-field views-field-field-building-address";
        const buildingTitle = "views-field views-field-title";
        try {
            for (const row of tableBody) {
                if (row.nodeName === "tr" && row.childNodes && row.childNodes.length > 0) {
                    for (const elt of row.childNodes) {
                        if (elt.nodeName === "td" && elt.attrs.length > 0) {
                            if (elt.attrs[0].value === buildingCode && elt.childNodes && elt.childNodes.length > 0) {
                                buildingInfo.shortname = elt.childNodes[0].value.trim();
                            }
                            if (elt.attrs[0].value === buildingTitle && elt.childNodes && elt.childNodes.length > 0) {
                                buildingInfo.href = elt.childNodes[1].attrs[0].value.trim();
                                if (elt.childNodes[1].childNodes && elt.childNodes[1].childNodes.length > 0) {
                                    buildingInfo.fullname = elt.childNodes[1].childNodes[0].value.trim();
                                }
                            }
                            if (elt.attrs[0].value === buildingAddress && elt.childNodes && elt.childNodes.length > 0) {
                                buildingInfo.address = elt.childNodes[0].value.trim();
                            }
                        }
                    }
                    try {
                        GeolocationHelper.getLatLon(buildingInfo).then((ret) => {
                            roomsPromise.push(DatasetHelper.processRooms(zip, buildingInfo));
                        });
                    } catch (e) {
                        // Geolocation errored out, just skip this building as per spec
                    }
                }
            }
            return Promise.all(roomsPromise).then((roomsArrays) => {
                for (const roomsArray of roomsArrays) {
                    rooms = rooms.concat(roomsArray);
                }
                return Promise.resolve(rooms);
            });
        } catch (e) {
            return Promise.reject(e);
        }
    }

    private static processRooms(zip: JSZip, buildingInfo: any): Promise<object[]> {
        let path = "rooms/campus/discover/buildings-and-classrooms/" + buildingInfo.shortname;
        let roomsArray: any[] = [];
        try {
            return zip.file(path).async("string").then((buildingHtml: string) => {
                const roomHtml = parse5.parse(buildingHtml);
                let rooms = DatasetHelper.findRooms(roomHtml);
                if (rooms) {
                    for (let room of rooms) {
                        let roomObject: { [key in RoomKeys]?: any } = {
                            [RoomKeys.Seats]: room[0],
                            [RoomKeys.Furniture]: room[1],
                            [RoomKeys.Type]: room[2],
                            [RoomKeys.Number]: room[3],
                            [RoomKeys.Address]: buildingInfo.address,
                            [RoomKeys.Fullname]: buildingInfo.fullname,
                            [RoomKeys.Shortname]: buildingInfo.shortname,
                            [RoomKeys.Name]: buildingInfo.shortname + "_" + room[3],
                            [RoomKeys.Href]: room[4],
                            [RoomKeys.Lat]: buildingInfo.lat,
                            [RoomKeys.Lon]: buildingInfo.lon
                        };
                        roomsArray.push(roomObject);
                    }
                }
                return Promise.resolve(roomsArray);
            }).catch((error) => {
                return Promise.reject(new InsightError());
            });
        } catch (e) {
            return Promise.reject(new InsightError());
        }
    }

    private static findTableBody(parsedIndexHTM: any): any {
        let table = "";
        if (parsedIndexHTM.childNodes && parsedIndexHTM.childNodes.length > 0) {
            for (const node of parsedIndexHTM.childNodes) {
                if (node.nodeName === "tbody") {
                    table = node.childNodes;
                } else {
                    if (node.childNodes && node.childNodes.length > 0) {
                        table = this.findTableBody(node);
                        if (table) {
                            return table;
                        }
                    }
                }
            }
        }
        return table;
    }

    private static findRooms(buildingHtml: string): any[] {
        let tableBody = DatasetHelper.findTableBody(buildingHtml);
        if (tableBody) {
            let rooms: object[] = [];
            const roomNumber = "views-field views-field-field-room-number";
            const roomSeats = "views-field views-field-field-room-capacity";
            const roomFurniture = "views-field views-field-field-room-furniture";
            const roomType = "views-field views-field-field-room-type";
            let numberRoom = "", seats = 0, type = "", furniture = "", href = "";
            for (const row of tableBody) {
                if (row.nodeName === "tr" && row.childNodes && row.childNodes.length > 0) {
                    for (const elt of row.childNodes) {
                        if (elt.nodeName === "td" && elt.attrs.length > 0) {
                            if (elt.attrs[0].value === roomSeats && elt.childNodes && elt.childNodes.length > 0) {
                                seats = +elt.childNodes[0].value.trim();
                            }
                            if (elt.attrs[0].value === roomFurniture && elt.childNodes && elt.childNodes.length > 0) {
                                furniture = elt.childNodes[0].value.trim();
                            }
                            if (elt.attrs[0].value === roomType && elt.childNodes && elt.childNodes.length > 0) {
                                type = elt.childNodes[0].value.trim();
                            }
                            if (elt.attrs[0].value === roomNumber && elt.childNodes && elt.childNodes.length > 0) {
                                if (elt.childNodes[1].childNodes && elt.childNodes[1].childNodes.length > 0) {
                                    numberRoom = elt.childNodes[1].childNodes[0].value.toString();
                                }
                                href = elt.childNodes[1].attrs[0].value;
                            }
                        }
                    }
                    rooms.push([seats, furniture, type, numberRoom, href]);
                }
            }
            return rooms;
        }
    }
}

