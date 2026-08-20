allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)

    // sunmi_printer_plus (and possibly other older plugins) leave their own Java/Kotlin compile
    // targets inconsistent against a modern JDK - Gradle picks up the JBR running the build
    // itself for Kotlin while AGP defaults Java compilation to 11, and refuses to build with the
    // two out of sync. Force every subproject (our own app plus every plugin module) to the same
    // JVM target this app already uses everywhere else. Registered here, before
    // evaluationDependsOn(":app") below forces early evaluation of some subprojects - afterEvaluate
    // throws if called once a project has already finished evaluating.
    afterEvaluate {
        // AGP configures its own JavaCompile tasks from android.compileOptions during project
        // evaluation, after a plain tasks.withType<JavaCompile> here would have run - has to go
        // through the extension itself, post-evaluate, to actually stick.
        extensions.findByType<com.android.build.gradle.BaseExtension>()?.compileOptions {
            sourceCompatibility = JavaVersion.VERSION_17
            targetCompatibility = JavaVersion.VERSION_17
        }
        plugins.withId("org.jetbrains.kotlin.android") {
            extensions.configure<org.jetbrains.kotlin.gradle.dsl.KotlinAndroidProjectExtension> {
                compilerOptions {
                    jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
                }
            }
        }
    }
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
