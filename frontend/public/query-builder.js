/**
 * Builds a query object using the current document object model (DOM).
 * Must use the browser's global document object {@link https://developer.mozilla.org/en-US/docs/Web/API/Document}
 * to read DOM information.
 *
 * @returns query object adhering to the query EBNF
 */
CampusExplorer.buildQuery = () => {
    let query = {};
    query["WHERE"] = getWhere();
    query["OPTIONS"] = getOptions();
    const transformations = getTransformations();
    if (transformations) {
        query["TRANSFORMATIONS"] = transformations;
    }
    return query;
};

function getWhere() {
    let where = {};
    const activeTab = getActiveTab();
    const logicConnector = getLogicConnector();
    const conditions = activeTab.getElementsByClassName("control-group condition");
    if (conditions.length === 0) {
        return where;
    }
    if (conditions.length === 1) {
        const cond = getOneCondition(conditions[0]);
        if (logicConnector === "NOT") {
            where["NOT"] = cond;
        } else {
            where = cond;
        }
        return where;
    }
    let conds = [];
    for (let condition of conditions) {
        conds.push(getOneCondition(condition));
    }
    if (logicConnector === "NOT") {
        where["NOT"]["OR"] = conds;
    } else {
        where[logicConnector] = conds;
    }
    return where;
}

function getActiveTab() {
    return document.getElementsByClassName("tab-panel active")[0];
}

function getID() {
    return getActiveTab().getAttribute("data-type");
}

function getLogicConnector() {
    const activeTab = getActiveTab();
    const types = activeTab.getElementsByClassName("control-group condition-type")[0].querySelectorAll("input");
    for (let condType of types) {
        if (condType.hasAttribute("checked")) {
            switch (condType.getAttribute("value")) {
                case "all":
                    return "AND";
                case "any":
                    return "OR";
                case "none":
                    return "NOT";
            }
        }
    }
}

function getOneCondition(condition) {
    const negation = condition.getElementsByClassName("control not")[0].querySelector("input").hasAttribute("checked");
    const keyOptions = condition.getElementsByClassName("control fields")[0].querySelectorAll("option");
    let field;
    for (let option of keyOptions) {
        if (option.hasAttribute("selected")) {
            field = getID() + "_" + option.getAttribute("value");
            break;
        }
    }
    const operatorOptions = condition.getElementsByClassName("control operators")[0].querySelectorAll("option");
    let operator;
    for (let option of operatorOptions) {
        if (option.hasAttribute("selected")) {
            operator = option.getAttribute("value");
            break;
        }
    }
    let term = condition.getElementsByClassName("control term")[0].querySelector("input").getAttribute("value");
    if (!term) {
        term = "";
    } else if (operator !== "IS" && !isNaN(term)) {
        term = Number(term);
    }
    if(negation) {
        return {"NOT": {[operator]: {[field]: term}}};
    } else {
        return {[operator]: {[field]: term}};
    }
}

function getOptions() {
    const activeTab = getActiveTab();
    let options = {};
    options["COLUMNS"] = [];
    const columnOptions = activeTab.getElementsByClassName("form-group columns")[0].querySelectorAll("input");
    for (let option of columnOptions) {
        if (option.hasAttribute("checked")) {
            if (option.hasAttribute("id")) {
                options["COLUMNS"].push(getID() + "_" + option.getAttribute("value"));
            } else {
                option["COLUMNS"].push(option.getAttribute("value"));
            }
        }
    }
    const orderOptions = activeTab.getElementsByClassName("form-group options")[0].querySelectorAll("option");
    let sortKeys = [];
    for (let option of orderOptions) {
        if (option.hasAttribute("selected")) {
            if (option.getAttribute("class") === "transformation") {
                sortKeys.push(option.getAttribute("value"));
            } else {
                sortKeys.push(getID() + "_" + option.getAttribute("value"));
            }
        }
    }
    if (sortKeys.length === 0) {
        return options;
    }
    if (activeTab.getElementsByClassName("form-group options")[0].querySelector("input").hasAttribute("checked")) {
        options["ORDER"] = {"dir": "DOWN", "keys": sortKeys};
    } else {
        options["ORDER"] = {"dir": "UP", "keys": sortKeys};
    }
    return options;
}

function getTransformations() {
    let group = getGroup();
    let apply = getApply();
    if (!group && !apply) {
        return null;
    }
    let transformations = {};
    transformations["GROUP"] = group ? group : [];
    transformations["APPLY"] = apply ? apply : [];
    return transformations;
}

function getGroup() {
    let group = null;
    const groupOptions = getActiveTab().getElementsByClassName("form-group groups")[0].querySelectorAll("input");
    for (let option of groupOptions) {
        if (option.hasAttribute("checked")) {
            if (!group) {
                group = [];
            }
            group.push(getID() + "_" + option.getAttribute("value"));
        }
    }
    return group;
}

function getApply() {
    const applyRules = getActiveTab().getElementsByClassName("control-group transformation");
    if (applyRules.length === 0) {
        return null;
    }
    let apply = [];
    for (let applyRule of applyRules) {
        const applyKey = applyRule.getElementsByClassName("control term")[0].querySelector("input").getAttribute("value");
        let applyToken;
        const tokenOptions = applyRule.getElementsByClassName("control operators")[0].querySelectorAll("option");
        for (let option of tokenOptions) {
            if (option.hasAttribute("selected")) {
                applyToken = option.getAttribute("value");
                break;
            }
        }
        let key;
        const keyOptions = applyRule.getElementsByClassName("control fields")[0].querySelectorAll("option");
        for (let option of keyOptions) {
            if (option.hasAttribute("selected")) {
                key = getID() + "_" + option.getAttribute("value");
                break;
            }
        }
        apply.push({[applyKey]: {[applyToken]: key}});
    }
    return apply;
}
