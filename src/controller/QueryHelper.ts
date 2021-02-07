import {InsightError} from "./IInsightFacade";
import * as fs from "fs-extra";
import {SectionKeys} from "./Dataset";

export class QueryHelper {
    // return true if WHERE exists, is a non-array object, empty or has exactly one valid key
    public static checkValidWhere(query: any): boolean {
        if (!("WHERE" in query) || query["WHERE"] === null || query["WHERE"] === undefined ||
            Array.isArray(query["WHERE"]) || query["WHERE"].constructor !== Object) {
            return false;
        }
        if (Object.keys(query["WHERE"]).length === 0) {
            return true;
        }
        return this.checkValidFilter(query["WHERE"]);
    }

    // return true if OPTIONS exists, is a non-array object, only contains key COLUMNS and possibly ORDER
    public static checkValidOptions(query: any): boolean {
        if (!("OPTIONS" in query) || query["OPTIONS"] === null || query["OPTIONS"] === undefined ||
            Array.isArray(query["OPTIONS"]) || query["OPTIONS"].constructor !== Object) {
            return false;
        }
        return (
            Object.keys(query["OPTIONS"]) === ["COLUMNS"] || Object.keys(query["OPTIONS"]) === ["COLUMNS", "ORDER"]
        );
    }

    // take a query and return a valid dataset id
    // if there is no valid id in query, throw InsightError
    // if an id is valid but does not exist in dataset, throw InsightError
    public static getId(query: any): string {
        // convert query to a string, use regex match to get all ids
        const ids: string[] = JSON.stringify(query).match(/[^"'_]+(?=_)/g);
        if (ids.length === 0) {
            throw new InsightError("Invalid dataset id in query");
        }
        for (const id of ids) {
            if (id !== ids[0]) {
                throw new InsightError("Invalid dataset id in query");
            }
        }
        let allSpaces: boolean = true;
        for (const c of ids[0]) {
            if (c !== " ") {
                allSpaces = false;
            }
        }
        if (allSpaces) {
            throw new InsightError("Invalid dataset id in query");
        }
        if (!fs.existsSync("./data" + ids[0])) {
            throw new InsightError("Dataset does not exist");
        }
        return ids[0];
    }

    // REQUIRE: filter is a non-empty JS object, has exactly one key and the key is valid
    // if any part of WHERE is invalid, throw InsightError
    // if filter is empty, return an all true array
    // otherwise, return a boolean array that indicates whether each section satisfies the filter
    public static processFilter(filter: any, sections: any[]): any[] {
        const filterKey = Object.keys(filter)[0];
        let booleanFilter: boolean[];  // a boolean array that indicates whether each section satisfies the filter
        switch (filterKey) {
            case "AND":
            case "OR":
                booleanFilter = this.performLogicComparison(filter, sections);
                break;
            case "GT":
            case "LT":
            case "EQ":
                booleanFilter = this.performMComparison(filter, sections);
                break;
            case "IS":
                booleanFilter = this.performSComparison(filter, sections);
                break;
            case "NOT":
                booleanFilter = this.performNegation(filter, sections);
                break;
        }
        return booleanFilter;
    }

    public static processOptions(options: any, sections: any[]) {

    }

    private static performLogicComparison(filter: any, sections: any[]): boolean[] {
        const logicFunc: string = Object.keys(filter)[0]; // logicFunc is either "AND" or "OR"
        // Logic comparison is not followed by an array
        if (filter[logicFunc] === undefined || filter[logicFunc] === null || !Array.isArray(filter[logicFunc])) {
            throw new InsightError(logicFunc + " is not followed by an array");
        }
        // Logic comparison is empty
        if (filter[logicFunc].length === 0) {
            throw new InsightError("Empty " + logicFunc);
        }
        let booleanFilter: boolean[];
        for (const subFilter of filter[logicFunc]) {
            if (!this.checkValidFilter(subFilter)) {
                throw new InsightError("Invalid filter in " + logicFunc);
            }
            booleanFilter = this.combineFilter(logicFunc, booleanFilter, this.processFilter(subFilter, sections));
        }
        return booleanFilter;
    }

    private static performMComparison(filter: any, sections: any[]): boolean[] {
        const comparator: string = Object.keys(filter)[0];
        // the comparison contains zero or more than one mkey
        if (Object.keys(filter[comparator]).length !== 1) {
            throw new InsightError(comparator + " contains zero or more than one mkey");
        }
        const mkey: string = Object.keys(filter[comparator])[0];
        const mfield: string = mkey.substring(mkey.indexOf("_") + 1);
        const validFields: string[] = [
            SectionKeys.Average, SectionKeys.Pass, SectionKeys.Fail, SectionKeys.Audit, SectionKeys.Year
        ];
        // invalid mfield
        if (!validFields.includes(mfield)) {
            throw new InsightError("Invalid mfield in " + comparator);
        }
        // the value to compare is not a number
        if (typeof filter[comparator][mkey] !== "number") {
            throw new InsightError(
                "Cannot compare number to " + typeof filter[comparator][mkey] + " in " + comparator
            );
        }
        let booleanFilter: boolean[];
        switch (comparator) {
            case "GT":
                booleanFilter = sections.map((section) => section[mfield] > filter[comparator][mkey]);
                break;
            case "LT":
                booleanFilter = sections.map((section) => section[mfield] < filter[comparator][mkey]);
                break;
            case "EQ":
                booleanFilter = sections.map((section) => section[mfield] === filter[comparator][mkey]);
                break;
        }
        return booleanFilter;
    }

    private static performSComparison(filter: any, sections: any[]): boolean[] {
        // the comparison contains zero or more than one skey
        if (Object.keys(filter["IS"]).length !== 1) {
            throw new InsightError("IS contains zero or more than one skey");
        }
        const skey: string = Object.keys(filter["IS"])[0];
        const sfield: string = skey.substring(skey.indexOf("_") + 1);
        const validFields: string[] = [
            SectionKeys.Department, SectionKeys.Id, SectionKeys.Instructor, SectionKeys.Title, SectionKeys.Uuid
        ];
        // invalid sfield
        if (!validFields.includes(sfield)) {
            throw new InsightError("Invalid sfield in IS");
        }
        // the value to compare is not a string
        if (typeof filter["IS"][skey] !== "string") {
            throw new InsightError("Cannot compare string to " + typeof filter["IS"][skey] + " in IS");
        }
        let inputString: string = filter["IS"][skey];
        // input string contains * in between
        if (inputString.length > 2 && inputString.substring(1, inputString.length - 1).includes("*")) {
            throw new InsightError("Invalid inputstring in IS");
        }
        let booleanFilter: boolean[];
        if (inputString[0] === "*" && inputString[inputString.length - 1] === "*") {
            // inputstring has * on both ends
            booleanFilter = sections.map(
                (section) => section[sfield].includes(inputString.substring(1, inputString.length - 1))
            );
        } else if (inputString[0] === "*") {
            // inputstring only has * at start
            booleanFilter = sections.map(
                (section) => section[sfield].endsWith(inputString.substring(1))
            );
        } else if (inputString[inputString.length - 1] === "*") {
            // inputstring only has * at end
            booleanFilter = sections.map(
                (section) => section[sfield].startsWith(inputString.substring(0, inputString.length - 1))
            );
        } else {
            // inputstring has no *
            booleanFilter = sections.map((section) => section[sfield] === inputString);
        }
        return booleanFilter;
    }

    private static performNegation(filter: any, sections: any[]): boolean[] {
        if (!this.checkValidFilter(filter["NOT"])) {
            throw new InsightError("Invalid filter in NOT");
        }
        let booleanFilter: boolean[] = this.processFilter(filter["NOT"], sections);
        for (let i in booleanFilter) {
            booleanFilter[i] = !booleanFilter[i];
        }
        return booleanFilter;
    }

    // return true if filter is a non-empty, non-array JS object and has exactly one valid key
    // otherwise, return false
    private static checkValidFilter(filter: any): boolean {
        if (filter === undefined || filter === null || Array.isArray(filter)) {
            return false;
        }
        if (Object.keys(filter).length !== 1) {
            return false;
        }
        return Object.keys(filter)[0] in ["AND", "OR", "GT", "LT", "EQ", "IS", "NOT"];
    }

    // if booleanFilter1 is undefined, return booleanFilter2
    // otherwise, return a boolean array resulting from applying logicFunc
    // on booleanFilter1 and booleanFilter2 entry-wise
    private static combineFilter(logicFunc: string, booleanFilter1: boolean[], booleanFilter2: boolean[]) {
        if (booleanFilter1 === undefined) {
            return booleanFilter2;
        }
        for (let i in booleanFilter1) {
            switch (logicFunc) {
                case "AND":
                    booleanFilter1[i] = (booleanFilter1[i] && booleanFilter2[i]);
                    break;
                case "OR":
                    booleanFilter1[i] = (booleanFilter1[i] || booleanFilter2[i]);
                    break;
            }
        }
        return booleanFilter1;
    }
}
