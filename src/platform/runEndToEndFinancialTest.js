import {
  runEndToEndFinancialTests
} from "../agents/endToEndFinancialTestAgent.js";


const result =
  runEndToEndFinancialTests();


console.log(
  JSON.stringify(
    result.summary,
    null,
    2
  )
);
