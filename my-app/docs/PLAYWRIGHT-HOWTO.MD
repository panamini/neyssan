How to write Playwright tests with Codex (step by step)
Now that your repo is ready, here is how to actually generate tests.

Step 1: write a clear task prompt
The quality of the generated test depends entirely on how well you describe the task. Be specific.

Weak prompt:
"Write tests for the login page."

Strong prompt:
"Write a Playwright test file at tests/auth/login.spec.ts that covers:

Successful login with valid email and password. Assert redirect to the home page.
Login with invalid password. Assert the error message "Invalid credentials" appears.
Login with empty fields. Assert both field validation messages appear. Use the existing LoginPage page object from tests/pages/login.page.ts. Follow the patterns in tests/auth/signup.spec.ts for reference."
The difference is context. When you tell Codex which files to reference, which page objects to use, and what assertions to make, it produces code that fits your project.




Tip: Reference existing spec files in your prompt. Codex will read those files and mirror the patterns, including import styles, describe block structure, and assertion methods. This is the fastest way to get consistent output.

Step 2: select the right branch and model
In the Codex dashboard, select the branch you want changes committed to. Codex creates a new branch off of your selected base branch and opens a PR against it.

The model is codex-1 by default. It is optimized for agentic tasks where the model needs to plan multiple steps, edit files, and run commands. This is different from GPT-4o which handles conversations well but is not tuned for long-running code tasks.

Step 3: submit and wait
Click Start coding. Codex will:

Clone your repo
Run the setup script
Read AGENTS.md and any files referenced in your prompt
Generate the test file(s)
Run npx playwright test to verify
You will see a progress indicator. For a typical single-file test task, expect 2 to 8 minutes depending on complexity.

Step 4: review the output
Once done, Codex shows you:

The full terminal log with every command it ran
A diff view of all file changes
Test results showing pass/fail status


If the tests passed in the sandbox, you can create the PR directly. If something failed, you can give follow-up instructions in the same task thread.

Run tests with reporting
Once configured, every npx playwright test run uploads results to TestDino automatically. You can also use the TestDino CLI for more control:


terminal

npx tdpw test


This command runs your Playwright suite and sends results to the TestDino dashboard where you get:

Real-time dashboards showing pass/fail rates per test, per file, per suite
Failure trends that surface which tests fail most often
Flaky test detection that flags tests with inconsistent results across runs
Execution timelines showing how long each test takes over time
For teams running Playwright parallel execution, TestDino aggregates results from all workers into a single view. It is the missing Playwright observability platform that connects your CI runs with actionable data.