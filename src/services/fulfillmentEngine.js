import { db } from "../db/database.js";
import { id } from "../utils.js";


export function createFulfillmentTask({

orderId,
providerId,
taskType="execution"

}) {


const taskId=id("task");


db.prepare(`
INSERT INTO fulfillment_tasks
(
id,
order_id,
provider_id,
task_type
)
VALUES (?,?,?,?)
`).run(

taskId,
orderId,
providerId,
taskType

);



return db.prepare(`
SELECT *
FROM fulfillment_tasks
WHERE id=?
`).get(taskId);


}



export function completeTask(
taskId,
result
){


db.prepare(`
UPDATE fulfillment_tasks

SET
status='completed',
result=?,
updated_at=CURRENT_TIMESTAMP

WHERE id=?
`).run(

JSON.stringify(result),
taskId

);



return db.prepare(`
SELECT *
FROM fulfillment_tasks
WHERE id=?
`).get(taskId);


}
