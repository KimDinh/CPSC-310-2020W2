/**
 * Receives a query object as parameter and sends it as Ajax request to the POST /query REST endpoint.
 *
 * @param query The query object
 * @returns {Promise} Promise that must be fulfilled if the Ajax request is successful and be rejected otherwise.
 */
CampusExplorer.sendQuery = (query) => {
    return new Promise((resolve, reject) => {
        // Code taken from https://javascript.info/xmlhttprequest with adaptations
        const http = new XMLHttpRequest();
        http.open("POST", "http://localhost:4321/query", true);
        http.setRequestHeader("Content-Type", "application/json");
        http.onload = function () {
            if (http.status === 200) {
                resolve(http.response);
            } else {
                reject(http.response);
            }
        }
        http.send(JSON.stringify(query));
    });
};
