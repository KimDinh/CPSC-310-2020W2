/**
 * Created by rtholmes on 2016-06-19.
 */

import fs = require("fs");
import restify = require("restify");
import Log from "../Util";
import InsightFacade from "../controller/InsightFacade";
import {IInsightFacade, InsightError, NotFoundError} from "../controller/IInsightFacade";

/**
 * This configures the REST endpoints for the server.
 */
export default class Server {

    private port: number;
    private rest: restify.Server;

    constructor(port: number) {
        Log.info("Server::<init>( " + port + " )");
        this.port = port;
    }

    /**
     * Stops the server. Again returns a promise so we know when the connections have
     * actually been fully closed and the port has been released.
     *
     * @returns {Promise<boolean>}
     */
    public stop(): Promise<boolean> {
        Log.info("Server::close()");
        const that = this;
        return new Promise(function (fulfill) {
            that.rest.close(function () {
                fulfill(true);
            });
        });
    }

    /**
     * Starts the server. Returns a promise with a boolean value. Promises are used
     * here because starting the server takes some time and we want to know when it
     * is done (and if it worked).
     *
     * @returns {Promise<boolean>}
     */
    public start(): Promise<boolean> {
        const that = this;
        return new Promise(function (fulfill, reject) {
            try {
                Log.info("Server::start() - start");

                that.rest = restify.createServer({
                    name: "insightUBC",
                });
                that.rest.use(restify.bodyParser({mapFiles: true, mapParams: true}));
                that.rest.use(
                    function crossOrigin(req, res, next) {
                        res.header("Access-Control-Allow-Origin", "*");
                        res.header("Access-Control-Allow-Headers", "X-Requested-With");
                        return next();
                    });

                // This is an example endpoint that you can invoke by accessing this URL in your browser:
                // http://localhost:4321/echo/hello
                that.rest.get("/echo/:msg", Server.echo);

                // NOTE: your endpoints should go here
                that.rest.put("/dataset/:id/:kind", Server.put);
                that.rest.del("/dataset/:id", Server.delete);
                that.rest.post("/query", Server.post);
                that.rest.get("/datasets", Server.get);

                // This must be the last endpoint!
                that.rest.get("/.*", Server.getStatic);

                that.rest.listen(that.port, function () {
                    Log.info("Server::start() - restify listening: " + that.rest.url);
                    fulfill(true);
                });

                that.rest.on("error", function (err: string) {
                    // catches errors in restify start; unusual syntax due to internal
                    // node not using normal exceptions here
                    Log.info("Server::start() - restify ERROR: " + err);
                    reject(err);
                });

            } catch (err) {
                Log.error("Server::start() - ERROR: " + err);
                reject(err);
            }
        });
    }

    public static put(req: restify.Request, res: restify.Response, next: restify.Next) {
        const iF: InsightFacade = new InsightFacade();
        Log.trace("Server::put(..) - params: " + JSON.stringify(req.params));
        try {
            let promise: any = iF.addDataset(req.params.id, new Buffer(req.body).toString("base64"), req.params.kind);
            return promise.then((response: any) => {
                Log.info("Server::put(..) - responding " + 200);
                res.json(200, {result: response});
                return next();
            }).catch((e: any) => {
                Log.error("Server::put(..) - responding 400");
                res.json(400, {error: e.message});
                return next();
            });
        } catch (err) {
            Log.error("Server::put(..) - responding 400");
            res.json(400, {error: err.message});
            return next();
        }
        return next();
    }

    public static delete(req: restify.Request, res: restify.Response, next: restify.Next) {
        const iF: InsightFacade = new InsightFacade();
        Log.trace("Server::delete(..) - params: " + JSON.stringify(req.params));
        try {
            let promise: any = iF.removeDataset(req.params.id);
            return promise.then((response: any) => {
                Log.info("Server::delete(..) - responding " + 200);
                res.json(200, {result: response});
                return next();
            }).catch((e: NotFoundError) => {
                Log.error("Server::delete(..) - responding 404");
                res.json(404, {error: e.message});
                return next();
            }).catch((e: InsightError) => {
                Log.error("Server::delete(..) - responding 400");
                res.json(400, {error: e.message});
                return next();
            });
        } catch (err) {
            Log.error("Server::delete(..) - responding 400");
            res.json(400, {error: err.message});
            return next();
        }
        return next();
    }

    public static post(req: restify.Request, res: restify.Response, next: restify.Next) {
        const iF: InsightFacade = new InsightFacade();
        Log.trace("Server::post(..) - params: " + JSON.stringify(req.params));
        try {
            let promise: any = iF.performQuery(req.body);
            return promise.then((response: any) => {
                Log.info("Server::post(..) - responding " + 200);
                res.json(200, {result: response});
                return next();
            }).catch((e: any) => {
                Log.error("Server::post(..) - responding 400");
                res.json(400, {error: e.message});
                return next();
            });
        } catch (err) {
            Log.error("Server::delete(..) - responding 400");
            res.json(400, {error: err.message});
            return next();
        }
        return next();
    }

    public static get(req: restify.Request, res: restify.Response, next: restify.Next) {
        const iF: InsightFacade = new InsightFacade();
        Log.trace("Server::get(..) - params: " + JSON.stringify(req.params));
        try {
            let promise: any = iF.listDatasets();
            return promise.then((response: any) => {
                Log.info("Server::get(..) - responding " + 200);
                res.json(200, {result: response});
                return next();
            }).catch((e: any) => {
                Log.error("Server::get(..) - responding 400. Will not do anything");
                return next();
            });
        } catch (err) {
            Log.error("Server::get(..) - responding 400. Will not do anything");
            return next();
        }
        return next();
    }

    // The next two methods handle the echo service.
    // These are almost certainly not the best place to put these, but are here for your reference.
    // By updating the Server.echo function pointer above, these methods can be easily moved.
    private static echo(req: restify.Request, res: restify.Response, next: restify.Next) {
        Log.trace("Server::echo(..) - params: " + JSON.stringify(req.params));
        try {
            const response = Server.performEcho(req.params.msg);
            Log.info("Server::echo(..) - responding " + 200);
            res.json(200, {result: response});
        } catch (err) {
            Log.error("Server::echo(..) - responding 400");
            res.json(400, {error: err});
        }
        return next();
    }

    private static performEcho(msg: string): string {
        if (typeof msg !== "undefined" && msg !== null) {
            return `${msg}...${msg}`;
        } else {
            return "Message not provided";
        }
    }

    private static getStatic(req: restify.Request, res: restify.Response, next: restify.Next) {
        const publicDir = "frontend/public/";
        Log.trace("RoutHandler::getStatic::" + req.url);
        let path = publicDir + "index.html";
        if (req.url !== "/") {
            path = publicDir + req.url.split("/").pop();
        }
        fs.readFile(path, function (err: Error, file: Buffer) {
            if (err) {
                res.send(500);
                Log.error(JSON.stringify(err));
                return next();
            }
            res.write(file);
            res.end();
            return next();
        });
    }

}
