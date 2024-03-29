import {InsightDatasetKind, InsightError} from "./IInsightFacade";
import * as fs from "fs-extra";
import {RoomKeys, SectionKeys} from "./Dataset";
import Log from "../Util";
import {TransformationHelper} from "./TransformationHelper";

export class QueryHelper {
    public static readonly MFIELDS: string[] =
        [SectionKeys.Average, SectionKeys.Pass, SectionKeys.Fail, SectionKeys.Audit, SectionKeys.Year,
        RoomKeys.Lat, RoomKeys.Lon, RoomKeys.Seats];

    public static readonly SFIELDS: string[] =
        [SectionKeys.Department, SectionKeys.Id, SectionKeys.Instructor, SectionKeys.Title, SectionKeys.Uuid,
        RoomKeys.Fullname, RoomKeys.Shortname, RoomKeys.Number, RoomKeys.Name, RoomKeys.Address, RoomKeys.Type,
        RoomKeys.Furniture, RoomKeys.Href];

    // return true if WHERE exists, is a non-array object, empty or has exactly one valid key
    public static checkValidWhere(query: any): boolean {
        if (!Object.keys(query).includes("WHERE") || query["WHERE"] === null || query["WHERE"] === undefined ||
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
        if (!Object.keys(query).includes("OPTIONS") || query["OPTIONS"] === null || query["OPTIONS"] === undefined ||
            Array.isArray(query["OPTIONS"]) || query["OPTIONS"].constructor !== Object) {
            return false;
        }
        const keys: string[] = Object.keys(query["OPTIONS"]);
        if (keys.length === 1) {
            return keys[0] === "COLUMNS";
        }
        if (keys.length === 2) {
            return (keys[0] === "COLUMNS" && keys[1] === "ORDER") || (keys[0] === "ORDER" && keys[1] === "COLUMNS");
        }
        return false;
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
        Log.trace(ids[0]);
        if (!fs.existsSync("data/" + ids[0] + ".json")) {
            throw new InsightError("Dataset does not exist");
        }
        return ids[0];
    }

    // REQUIRE: filter is a JS object, has exactly one key and the key is valid
    // if any part of WHERE is invalid, throw InsightError
    // if filter is empty, return an all true array
    // otherwise, return a boolean array that indicates whether each section satisfies the filter
    public static processFilter(id: string, kind: string, filter: any, sections: any[]): any[] {
        const filterKey = Object.keys(filter)[0];
        let booleanFilter: boolean[];  // a boolean array that indicates whether each section satisfies the filter
        switch (filterKey) {
            case "AND":
            case "OR":
                booleanFilter = this.performLogicComparison(id, kind, filter, sections);
                break;
            case "GT":
            case "LT":
            case "EQ":
                booleanFilter = this.performMComparison(id, kind, filter, sections);
                break;
            case "IS":
                booleanFilter = this.performSComparison(id, kind, filter, sections);
                break;
            case "NOT":
                booleanFilter = this.performNegation(id, kind, filter, sections);
                break;
        }
        return booleanFilter;
    }

    // REQUIRE: options is a JS object, has key COLUMNS (and possibly ORDER)
    // return an array of sections with the keys in columns, sections are sorted if a valid ORDER exists
    public static processOptions(id: string, kind: string, options: any, sections: any[]): any[] {
        const columnFields: string[] = this.getColumnFields(id, kind, options["COLUMNS"]);
        for (const section of sections) {
            for (const key in section) {
                if (columnFields.includes(key)) {
                    section[id + "_" + key] = section[key];
                }
                delete section[key];
            }
        }
        if (!Object.keys(options).includes("ORDER")) {
            return sections;
        }
        if (typeof options["ORDER"] === "string") {
            return TransformationHelper.defaultSort(options["ORDER"], options["COLUMNS"], sections);
        } else {
            return TransformationHelper.customSort(options["ORDER"], options["COLUMNS"], sections);
        }
    }

    private static performLogicComparison(id: string, kind: string, filter: any, sections: any[]): boolean[] {
        const logicFunc: string = Object.keys(filter)[0]; // logicFunc is either "AND" or "OR"
        // Logic comparison is not followed by an array
        if (!Array.isArray(filter[logicFunc])) {
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
            booleanFilter = this.combineFilter(logicFunc, booleanFilter,
                this.processFilter(id, kind, subFilter, sections));
        }
        return booleanFilter;
    }

    private static performMComparison(id: string, kind: string, filter: any, sections: any[]): boolean[] {
        const comparator: string = Object.keys(filter)[0];
        // the comparison contains zero or more than one mkey
        if (Object.keys(filter[comparator]).length !== 1) {
            throw new InsightError(comparator + " contains zero or more than one mkey");
        }
        const mkey: string = Object.keys(filter[comparator])[0];
        const mfield: string = this.getField(id, kind, mkey, "M");
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

    private static performSComparison(id: string, kind: string, filter: any, sections: any[]): boolean[] {
        // the comparison contains zero or more than one skey
        if (Object.keys(filter["IS"]).length !== 1) {
            throw new InsightError("IS contains zero or more than one skey");
        }
        const skey: string = Object.keys(filter["IS"])[0];
        const sfield: string = this.getField(id, kind, skey, "S");
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
        if (inputString === "*" || inputString === "**") {
            booleanFilter = sections.map(() => true);
        } else if (inputString[0] === "*" && inputString[inputString.length - 1] === "*") {
            booleanFilter = sections.map(
                (section) => section[sfield].includes(inputString.substring(1, inputString.length - 1))
            );
        } else if (inputString[0] === "*") {
            booleanFilter = sections.map(
                (section) => section[sfield].endsWith(inputString.substring(1))
            );
        } else if (inputString[inputString.length - 1] === "*") {
            booleanFilter = sections.map(
                (section) => section[sfield].startsWith(inputString.substring(0, inputString.length - 1))
            );
        } else {
            booleanFilter = sections.map((section) => section[sfield] === inputString);
        }
        return booleanFilter;
    }

    private static performNegation(id: string, kind: string, filter: any, sections: any[]): boolean[] {
        if (!this.checkValidFilter(filter["NOT"])) {
            throw new InsightError("Invalid filter in NOT");
        }
        let booleanFilter: boolean[] = this.processFilter(id, kind, filter["NOT"], sections);
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
        return ["AND", "OR", "GT", "LT", "EQ", "IS", "NOT"].includes(Object.keys(filter)[0]);
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

    // REQUIRE: fieldType is "M", "S", or undefined, id is valid
    // "M" refers mfield, "S" refers to sfield
    // if key is not of the form id + "_" + a valid section key of type fieldType, throw InsightError
    // otherwise return the field that follows the underscore
    public static getField(id: string, kind: string, key: any, fieldType: string): string {
        if (typeof key !== "string" || !key.includes("_") || key.substring(0, key.indexOf("_")) !== id) {
            throw new InsightError("Invalid key");
        }
        const field: string = key.substring(key.indexOf("_") + 1);
        if ((kind === InsightDatasetKind.Courses && !Object.values(SectionKeys).includes(field as SectionKeys)) ||
            (kind === InsightDatasetKind.Rooms && !Object.values(RoomKeys).includes(field as RoomKeys))) {
            throw new InsightError("Key does not belong to dataset kind");
        }
        if (fieldType === "M" && !this.MFIELDS.includes(field)) {
            throw new InsightError("Expected mkey");
        }
        if (fieldType === "S" && !this.SFIELDS.includes(field)) {
            throw new InsightError("Expected skey");
        }
        return field;
    }

    // if columns is not an array or is an empty array, throw InsightError
    // otherwise, return an array of distinct fields that appear in query result
    private static getColumnFields(id: string, kind: string, columns: any): string[] {
        if (!Array.isArray(columns) || columns.length === 0) {
            throw new InsightError("COLUMNS is must be a non-empty array");
        }
        let columnFields: string[] = [];
        for (const key of columns) {
            let field: string = this.getField(id, kind, key, undefined);
            if (!columnFields.includes(field)) {
                columnFields.push(field);
            }
        }
        return columnFields;
    }
}
