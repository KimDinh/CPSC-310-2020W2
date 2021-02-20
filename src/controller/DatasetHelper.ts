import {InsightDatasetKind, InsightError} from "./IInsightFacade";
import * as fs from "fs-extra";
import {Dataset, SectionKeys} from "./Dataset";
import * as JSZip from "jszip";

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
        if (kind === InsightDatasetKind.Rooms || kind === null || kind === undefined) {
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
            } catch (e) {
                // do nothing
            }
        });
        return sections;
    }

    // Code help from
    // https://stackoverflow.com/questions/39939644/jszip-checking-if-a-zip-folder-contains-a-specific-file
    // return true if "courses" folder exist in the zip file
    public static checkValidCoursesFolder(zip: JSZip) {
        if (zip.folder(/courses/).length > 0) {
            return true;
        } else {
            return false;
        }
    }

    public static addKind(sections: object[], id: string, kind: InsightDatasetKind) {
        let retVal = [
            {
                data: sections,
                kind: kind,
                rows: sections.length
            }
        ];
        return retVal;
    }

    public static getAllCurDatasets(dataDir: string) {
        let allCurDatasetIds: string[] = [];
        try {
            let datasetsRaw = fs.readdirSync(dataDir);
            datasetsRaw.forEach( function (datasetRaw) {
                allCurDatasetIds.push(datasetRaw.split(".")[0]);
            });
            return Promise.resolve(allCurDatasetIds);
        } catch (e) {
            return Promise.resolve(allCurDatasetIds);
        }
    }
}

