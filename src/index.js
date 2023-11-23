const fs = require("fs");
const { parse } = require("csv-parse");

const fileName = "AstorSession-test.txt"

const logMap = {}
const generateMap = () => {
  fs.createReadStream(`./logs/${fileName}`)
  .pipe(parse({ delimiter: " | ", from_line: 1 }))
  .on("data", function (row) {
    if (!logMap[row[1]]) {
      logMap[row[1]] = []
    }
    const record = {
      id: row[1],
      date: row[0],
      dateFormatted: new Date(row[0]),
      type: row[2],
      details: row[3]
    }
    logMap[record.id].push(record)
  }).on("end", () => {

    const auditLoginOnly = Object.keys(logMap).reduce((prev, id) =>{
      const values = logMap[id] || []
      const isLoginRecord = values.some(({type, details}) => {
        return type === "INICIO" && details.trim().startsWith("TAstorSession.IsValidUser User :")
      })
      return  isLoginRecord ? {
        ...prev,
        [id]: {
          logs: values,
          loginType: ""
        }
      } : prev
    }, {})
    console.log("auditLoginOnly", auditLoginOnly)
  })

}

generateMap()
