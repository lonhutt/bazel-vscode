import * as vscode from "vscode";

const JAVA_OPS: vscode.ShellExecutionOptions = {
  env: {
    JAVA_HOME: vscode.workspace
              .getConfiguration()
              .get("java.jdt.ls.java.home", "bad/path"),
  }
};

const tasksDefenitions: BazelTargetDefinition[] = [
  {type: "bazel", name: "Build", target: "bazel build //..."},
  {type: "bazel", name: "Test", target: "bazel test //..."},
  {type: "bazel", name: "Dependencies", target: 'bazel query  --notool_deps --noimplicit_deps "deps(//...)" --output graph'},
  {type: "bazel", name: "Formatting", target: 'buildifier -r . && echo "Formatted"'},
  {type: "bazel", name: "Unused deps", target: "unused_deps //..."}
];

export class BazelTaskProvider implements vscode.TaskProvider {

  public static BAZEL_TYPE = "bazel";

  private bazelPromise: Thenable<vscode.Task[]> | undefined = undefined;

  provideTasks(token: vscode.CancellationToken): vscode.ProviderResult<vscode.Task[]> {
      if (!this.bazelPromise) {
      this.bazelPromise = getBazelTasks();
    }
    return this.bazelPromise;
  }
  resolveTask(_task: vscode.Task, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Task> {
    const task = _task.definition.target;
    if(task){
      const definition: BazelTargetDefinition = <any>_task.definition;
      return new vscode.Task(
        definition,
        _task.scope ?? vscode.TaskScope.Workspace,
        definition.target,
        BazelTaskProvider.BAZEL_TYPE,
        new vscode.ShellExecution(definition.target, JAVA_OPS)
      );
    }
    return undefined;
  } 
}

interface BazelTargetDefinition extends vscode.TaskDefinition {
  name: string;
  target: string;   
}

function getBazelTasks(): Promise<vscode.Task[]> {
  return Promise.resolve(tasksDefenitions.map(value => new vscode.Task(
    value,
    vscode.TaskScope.Workspace,
    value.name,
    BazelTaskProvider.BAZEL_TYPE,
    new vscode.ShellExecution(value.target, JAVA_OPS)
  )));
}