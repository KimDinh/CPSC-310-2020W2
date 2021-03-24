import {InsightError} from "./IInsightFacade";
import {QueryHelper} from "./QueryHelper";
import Log from "../Util";

export class TransformationHelper {
    // return true if TRANSFORMATION does not exists or it exists and only contains GROUP and APPLY
    public static checkValidTransformation(query: any): boolean {
        if (!Object.keys(query).includes("TRANSFORMATIONS")) {
            return true;
        }
        if (query["TRANSFORMATIONS"] === null || query["TRANSFORMATIONS"] === undefined ||
            Array.isArray(query["TRANSFORMATIONS"]) || query["TRANSFORMATIONS"].constructor !== Object) {
            return false;
        }
        const keys: string[] = Object.keys(query["TRANSFORMATIONS"]);
        return keys.length === 2 && keys[0] === "GROUP" && keys[1] === "APPLY";
    }

    // REQUIRE: TRANSFORM contains GROUP and APPLY keys
    public static processTransform(id: string, kind: string, transform: any, sections: any[]): any {
        const groups = this.getGroups(id, kind, transform["GROUP"], sections);
        let applyResults: any[] = [];
        for (const group of groups) {
            applyResults.push(this.processApply(id, kind, transform["APPLY"], group));
        }
        const transformResult = {GROUP: groups, APPLY: applyResults};
        return transformResult;
    }

    private static getGroups(id: string, kind: string, group: any, sections: any[]): any {
        if (!Array.isArray(group) || group.length === 0) {
            throw new InsightError("GROUP is must be a non-empty array");
        }
        let groups: {[key: string]: any[]} = {};
        for (const section of sections) {
            let sectionKeyByGroup: string = "";
            for (const key of group) {
                const field: string = QueryHelper.getField(id, kind, key, undefined);
                sectionKeyByGroup = sectionKeyByGroup + section[field].toString() + "_dummy_string_";
            }
            if (!groups.hasOwnProperty(sectionKeyByGroup)) {
                groups[sectionKeyByGroup] = [section];
            } else {
                groups[sectionKeyByGroup].push(section);
            }
        }
        return Object.values(groups);
    }

    private static processApply(id: string, kind: string, apply: any, sections: any[]): any {
        let applyKeys: string[] = [];
        let applyResult: {[applyKey: string]: any} = {};
        for (const applyRule of apply) {
            if (applyRule === undefined || applyRule === null ||
                Array.isArray(applyRule) || Object.keys(applyRule).length !== 1) {
                throw new InsightError("Invalid APPLYRULE");
            }
            const applyKey: string = Object.keys(applyRule)[0];
            if (applyKey.includes("_")) {
                throw new InsightError("Applykey contains underscore");
            }
            if (applyKeys.includes(applyKey)) {
                throw new InsightError("Repeated applykey");
            }
            applyKeys.push(applyKey);
            if (applyRule[applyKey] === undefined || applyRule[applyKey] === null ||
                Array.isArray(applyRule[applyKey]) || Object.keys(applyRule[applyKey]).length !== 1) {
                throw new InsightError("Invalid APPLYRULE");
            }
            const token: string = Object.keys(applyRule[applyKey])[0];
            const key = applyRule[applyKey][token];
            let field: string;
            if (token === "COUNT") {
                field = QueryHelper.getField(id, kind, key, undefined);
            } else {
                field = QueryHelper.getField(id, kind, key, "M");
            }
            switch (token) {
                case "MAX":
                    applyResult[applyKey] = this.applyMax(sections, field);
                    break;
                case "MIN":
                    applyResult[applyKey] = this.applyMin(sections, field);
                    break;
                case "SUM":
                    applyResult[applyKey] = this.applySum(sections, field);
                    break;
                case "AVG":
                    applyResult[applyKey] = this.applyAvg(sections, field);
                    break;
                case "COUNT":
                    applyResult[applyKey] = this.applyCount(sections, field);
                    break;
                default:
                    throw new InsightError("Invalid apply token");
            }
        }
        return applyResult;
    }

    public static processOptionsTransform(id: string, kind: string, options: any,
                                          transform: any, transformResult: any): any[] {
        const columns = options["COLUMNS"];
        if (!Array.isArray(columns) || columns.length === 0) {
            throw new InsightError("COLUMNS is must be a non-empty array");
        }
        const applyKeys: string[] = this.getApplyKeys(transform["APPLY"]);
        const groupKeys: string[] = transform["GROUP"];
        for (const column of columns) {
            if ((column.includes("_") && !groupKeys.includes(column)) ||
                (!column.includes("_") && !applyKeys.includes(column))) {
                throw new InsightError("Invalid key in COLUMNS");
            }
        }
        let groups = transformResult["GROUP"];
        let applyResult = transformResult["APPLY"];
        let sections = [];
        for (const i in groups) {
            let section: {[key: string]: any} = {};
            for (const column of columns) {
                if (column.includes("_")) {
                    section[column] = groups[i][0][QueryHelper.getField(id, kind, column, undefined)];
                } else {
                    section[column] = applyResult[i][column];
                }
            }
            sections.push(section);
        }
        if (options.hasOwnProperty("ORDER")) {
            if (typeof options["ORDER"] === "string") {
                return this.defaultSort(options["ORDER"], columns, sections);
            } else {
                return this.customSort(options["ORDER"], columns, sections);
            }
        } else {
            return sections;
        }
    }

    // REQUIRE: all apply keys are distinct
    private static getApplyKeys(apply: any): string[] {
        let applyKeys: string[] = [];
        for (const applyRule of apply) {
            applyKeys.push(Object.keys(applyRule)[0]);
        }
        return applyKeys;
    }

    // REQUIRE: field is a numeric key and exists in sections
    private static applyMax(sections: any[], field: string): number {
        let curMax = sections[0][field];
        for (const section of sections) {
            curMax = Math.max(curMax, section[field]);
        }
        return curMax;
    }

    // REQUIRE: field is a numeric key and exists in sections
    private static applyMin(sections: any[], field: string): number {
        let curMin = sections[0][field];
        for (const section of sections) {
            curMin = Math.min(curMin, section[field]);
        }
        return curMin;
    }

    // REQUIRE: field is a numeric key and exists in sections
    private static applySum(sections: any[], field: string): number {
        let curSum: number = 0;
        for (const section of sections) {
            curSum += section[field];
        }
        return curSum;
    }

    // REQUIRE: field is a numeric key and exists in sections
    private static applyAvg(sections: any[], field: string): number {
        const Decimal = require("decimal.js");
        let sum = new Decimal(0);
        for (const section of sections) {
            sum = Decimal.add(sum, new Decimal(section[field]));
        }
        let avg = sum.toNumber() / sections.length;
        return Number(avg.toFixed(2));
    }

    // REQUIRE: field is a key that exists in sections
    private static applyCount(sections: any[], field: string): number {
        let values = new Set();
        for (const section of sections) {
            if (!values.has(section[field])) {
                values.add(section[field]);
            }
        }
        return values.size;
    }

    public static defaultSort(sortKey: string, columns: string[], sections: any[]): any[] {
        if (!columns.includes(sortKey)) {
            throw new InsightError("ORDER key is not in COLUMNS");
        }
        sections.sort((section1, section2) => {
            if (section1[sortKey] < section2[sortKey]) {
                return -1;
            }
            return 1;
        });
        return sections;
    }

    public static customSort(order: any, columns: string[], sections: any[]): any[] {
        const dir = order["dir"];
        const keys = order["keys"];
        if (!dir || (dir !== "UP" && dir !== "DOWN") || !keys || !Array.isArray(keys) || keys.length === 0) {
            throw new InsightError("Invalid ORDER");
        }
        for (const key of keys) {
            if (!columns.includes(key)) {
                throw new InsightError("ORDER key is not in COLUMNS");
            }
        }
        sections.sort((section1, section2) => {
            let index = 0;
            while (index < keys.length && section1[keys[index]] === section2[keys[index]]) {
                index++;
            }
            if (index === keys.length) {
                return 0;
            }
            if ((dir === "UP" && section1[keys[index]] < section2[keys[index]]) ||
                (dir === "DOWN" && section1[keys[index]] > section2[keys[index]])) {
                    return -1;
            }
            return 1;
        });
        return sections;
    }
}
