export class Section {

    // JSO containing properties of the section
    // content's keys are from CourseKeys
    private content: any;

    // takes a JSO that contains the keys in CourseKeys and initialize the content of this section
    constructor(content: any) {
        this.content = content;
    }

    // takes a key and return properties of this section
    public get(key: string): any {
        return this.content[key];
    }
}
