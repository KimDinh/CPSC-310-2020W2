import {Section} from "./Section";
import {InsightDatasetKind} from "./IInsightFacade";

export class Dataset {
    private id: string;
    private kind: InsightDatasetKind;
    private sections: Section[];

    constructor(id: string, kind: InsightDatasetKind, sections: Section[]) {
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

    public getSections(): Section[] {
        return this.sections;
    }
}

export enum CourseKeys {
    Department = "dept",
    Id = "id",
    Average = "avg",
    Instructor = "instructor",
    Title = "title",
    Pass = "pass",
    Fail = "fail",
    Audit = "audit",
    Uuid = "uuid",
    Year = "year",
}
