var application = require("application");
try {
    throw new Error("caught error");
}
catch(e) {
    console.log(e);
}

throw new Error("uncaught error");
application.start({ moduleName: "main-page" });