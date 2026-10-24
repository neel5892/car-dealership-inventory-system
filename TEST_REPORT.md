# Test Report - Car Dealership Inventory System



## 1. Overview



**Project:** Car Dealership Inventory System  

**Test framework:** Vitest  

**HTTP testing library:** Supertest  

**Test file:** `backend/tests/app.test.ts`



## 2. Test Execution



Command executed:



```bash

npx vitest run --reporter=verbose

```



## 3. Results



| Metric | Result |

|---|---:|

| Test files passed | 1 |

| Test files failed | 0 |

| Tests passed | 21 |

| Tests failed | 0 |

| Total duration | 20.95 seconds |



**Outcome: PASS**



## 4. Test Cases



| Area | Test coverage |

|---|---|

| Vehicle listing | Returns an empty vehicle list |

| Vehicle creation | Adds a vehicle |

| Input validation | Rejects negative price and quantity |

| Vehicle search | Searches by make and price range |

| Search validation | Rejects an invalid price range |

| Vehicle updates | Updates a vehicle and returns 404 for a nonexistent vehicle |

| Purchasing | Decreases stock, rejects purchase when stock is zero, and handles nonexistent vehicles |

| Restocking | Allows administrators, rejects regular users, rejects quantity zero, and handles nonexistent vehicles |

| Authentication | Rejects vehicle access without a token and login with an incorrect password |

| Registration | Rejects duplicate email addresses |

| Authorization | Allows administrator deletion and rejects deletion by a regular user |



## 5. Evidence



The test suite completed successfully during local development.



Observed terminal summary:



```text

Test Files  1 passed (1)

Tests       21 passed (21)

Duration    20.95s

```



## 6. Limitations



This report documents the observed backend test run. It does not establish complete code coverage, production readiness, deployment verification, or independent security testing.



The existing Git history does not demonstrate a complete test-first Red-Green-Refactor sequence. The successful test results should not be interpreted as proof that every test was written before its implementation.



## 7. Reproduction



From the repository root, run:



```bash

cd backend

npm install

npx vitest run --reporter=verbose

```




