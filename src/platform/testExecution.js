import {
 createServiceOrder
} from "../services/executionEngine.js";


import {
 db
} from "../db/database.js";


const opportunity =
db.prepare(`
SELECT *
FROM agent_opportunities
ORDER BY created_at DESC
LIMIT 1
`).get();



if(!opportunity){

 throw new Error(
 "No opportunity found"
 );

}



const order =
createServiceOrder({

 opportunity,

 agentId:
 opportunity.agent_id

});



console.log(
JSON.stringify(
{
status:"PASS",
opportunity,
order
},
null,
2
)
);
