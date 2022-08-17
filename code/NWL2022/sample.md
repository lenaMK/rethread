## Sample JSON datasets

Sample JSON datasets for method calls occurring during execution can be found:
- for PDFBox [here](https://kth-my.sharepoint.com/:u:/g/personal/deepikat_ug_kth_se/EXDt-aFckBdDiDBmGG34MKgBtgveYPQRVYNyrXLwk20d1A?e=joqta1)
- for the inversion of a 100 x 100 matrix [here](https://kth-my.sharepoint.com/:u:/g/personal/deepikat_ug_kth_se/EVEXcc85WkxNuT4sfPQ_7ZkBrYo-ZXkszyUFQPhO5eQEuw?e=ugrZWd)

The data is of the following format:
```
[{
  "callee" : {
    "fqn" : "org.apache.pdfbox.tools.Encrypt.main",
    "supplier" : "org.apache",
    "dependency" : "pdfbox"
  },
  "caller" : {
    "fqn" : "org.apache.pdfbox.tools.PDFBox.main",
    "supplier" : "org.apache",
    "dependency" : "pdfbox"
  },
  "timestamp" : 1660074643479
}, ...]
```

### What's included
- Each element in this array represents one method call
- The `callee` is the method that is invoked by the `caller`
  - In the example above, the method `main` in the class `org.apache.pdfbox.tools.PDFBox` calls the method `main` in `org.apache.pdfbox.tools.Encrypt`
- For the caller and the callee, we include the
  - `fqn`: the fully qualified name of the method
  - `supplier`: the organisation that owns the project
  - `dependency`: the library/project where the method is defined
  - Note that the `dependency` is an approximation and may sometimes be incorrect
- Additionally, as a proxy of the sequence of method calls, we assign a `timestamp` to each method call


## Sample TXT datasets

Sample TXT datasets for method calls during dynamic execution can be found:
- for the inversion of a 42 x 42 matrix the **calltrace** is [here](https://kth-my.sharepoint.com/:t:/g/personal/cesarsv_ug_kth_se/EW4EL-_DEolAmRB93lBkcmQB4L61gX9OY5_EWUr9XHAzxw?e=8lHreq)
- for the inversion of a 42 x 42 matrix **method calls** are [here](https://kth-my.sharepoint.com/:t:/g/personal/cesarsv_ug_kth_se/ESyJw9xuyrFLi6jiFDCQFWsBKkKiKt4Orf0IsCZzjwVBlQ?e=Bkwlfw)

The **calltrace** shows method call pairs as shown below:

```text
class1:method1 class2:method2 numcalls
```
The **method calls**, which writes the entry and exit timestamps for methods, is of the following format:

```text
<>[stack_depth][thread_id]fqdn.class:method=timestamp_nanos
```

The output line starts with a `<` or `>` depending on whether it is a method entry or exit.
It then writes the stack depth, thread id and the class and method name, followed by a timestamp in nano seconds. 

### How to reproduce

Build the Docker image for the minvert Maven project using the [Dockerfile](code/NWL2022/minvert/Dockerfile) and then run the container.

To copy the minvert `jar-with-dependencies.jar` to the local filesystem (>1.3GB), run the following command:

```bash
sudo docker cp <container_name>:/usr/local/lib/app.jar <path_in_local_file_system>
```

To trace the execution of the minvert application with the [javacg-0.1-SNAPSHOT-dycg-agent.jar](code/NWL2022/minvert-traces/javacg-0.1-SNAPSHOT-dycg-agent.jar), run the following command:

```bash 
java -javaagent:javacg-0.1-SNAPSHOT-dycg-agent.jar="incl=org.*;excl=org.apache.commons.lang3.*,org.nd4j.*,org.bytedeco.*" -cp javacg-0.1-SNAPSHOT-dycg-agent.jar:minvert-0.1-jar-with-dependencies-jdk8.jar -jar minvert-0.1-jar-with-dependencies-jdk8.jar > traces/minvert-trace.txt
``` 

Note that we are using Java 8 for building the minvert artifact, the agent, and the JVM execution. 
