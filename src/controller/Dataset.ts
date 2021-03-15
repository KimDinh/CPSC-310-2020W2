import {Section} from "./Section";
import {InsightDatasetKind} from "./IInsightFacade";

export class Dataset {
    private id: string;
    private kind: InsightDatasetKind;
    private sections: any[];

    constructor(id: string, kind: InsightDatasetKind, sections: any[]) {
        this.id = id;
        this.kind = kind;
        this.sections = sections;
    }

    public getId(): string {
        return this.id;
    }

    public getKind(): InsightDatasetKind {
        return this.kind;
    }

    public getSections(): any[] {
        return this.sections;
    }
}

export enum RoomKeys {
    Lat = "lat",
    Lon = "lon",
    Seats = "seats",
    Fullname = "fullname",
    Shortname = "shortname",
    Number = "number",
    Name = "name",
    Address = "address",
    Type = "type",
    Furniture = "furniture",
    Href = "href",
}

export enum SectionKeys {
    Department = "dept",
    Id = "id",
    Instructor = "instructor",
    Title = "title",
    Uuid = "uuid",
    Average = "avg",
    Pass = "pass",
    Fail = "fail",
    Audit = "audit",
    Year = "year",
}

