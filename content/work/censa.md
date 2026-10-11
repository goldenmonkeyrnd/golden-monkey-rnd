---
title: "Secure infrastructure for public-health analytics"
eyebrow: "Indiana Department of Health · Delivery experience"
description: "Pauline Yeary’s Azure infrastructure, Bicep remediation, security review and handoff work for an Indiana Department of Health analytics application."
lead: "Epidemiologists needed to explore large census datasets without taking on SQL as a second specialty. My role was to make the supporting Azure infrastructure work within the agency’s requirements."
---
## The application and my responsibility

The Censa application combined Streamlit, DuckDB and Census Parquet data. It offered a convenient interface for population analysis that supported epidemiologists investigating public-health issues across Indiana. Another developer built the web application. I delivered and remediated its supporting Azure cloud infrastructure while working as a Data Engineer at Resultant.

## Turn security findings into working infrastructure

The agency’s cybersecurity team provided findings from its assessment. I worked through the results, checked the relevant Azure documentation and translated the required changes into Bicep and deployment configuration.

The work included private storage connectivity and network isolation, managed identities, and access through Microsoft Entra groups. Group-based access let the agency change staff access by updating membership rather than maintaining individual users in deployment code. I navigated Azure Policy alongside agency-specific requirements and NIST 800-53-aligned controls.

I verified deployments and reviewed the infrastructure and remediations with the cybersecurity team. That team operated the security assessment tooling; I implemented the infrastructure changes and participated in the review. This was not a formal authorization-to-operate process or a security certification.

## Leave a useful handoff

When the contract ended after project funding was withdrawn, I prepared documentation in an Azure DevOps wiki, integrated it into the agency’s existing documentation, and presented the solution to the cloud team. I walked through the infrastructure and Bicep deployment and answered implementation questions.

I also left a CI/CD foundation that included automated Trivy scanning and a structure the agency could extend. The pipeline was unfinished. I cannot claim completed blue-green deployment, automated patch enforcement or ongoing operation after handoff. Access ended with the contract, so I did not verify subsequent maintenance.

## What I bring to the next team

This assignment expanded beyond my original data-engineering role. I learned the cloud requirements, collaborated with people who had different expertise and delivered infrastructure that supported a real agency application. I value that combination of adaptability, explicit ownership and careful follow-through.

This case study describes my contribution without publishing agency source code, tenant details or internal assessment records.
