# Deploying .NET Web API to Azure Kubernetes Service (AKS) with Terraform, Helm, & GitHub Actions

This project demonstrates how to deploy a .NET Web API application (backend) and an Angular client (frontend) to Azure Kubernetes Service (AKS) using **Terraform** for infrastructure provisioning, **Helm** for packaging the application, **Prometheus and Grafana** for monitoring, and **GitHub Actions** for CI/CD, providing an end-to-end example setup.

**Note on Kubernetes Deployment:** This project uses Helm charts for deployment. For a simpler approach using **raw Kubernetes YAML manifests**, please refer to the following repository https://github.com/kaajoj/iac-azure-dotnet-api-angular-aks

## Project Structure

```
.
├── infra/              # Terraform code
│   └── charts/         # Helm chart
├── src/MyWebApp/       # .NET Web API project (Backend)
├── src/MyWebApp.Client/ # Angular project (Frontend)
└── .github/workflows/  # CI/CD workflows
    ├── infra.yml
    ├── deploy.yml
    └── destroy.yml
```

## Infrastructure/Services overview (via Terraform)

The following Azure services are provisioned:

- **Resource Group**: A logical container for Azure resources.
- **Azure Kubernetes Service (AKS)**: Managed Kubernetes cluster to host the application containers.
- **Container Registry** (ACR): To store Docker images for the .NET Web API and Angular client.
- **Key Vault**: Stores secrets like the SQL connection string, with identity-based access.
- **Azure SQL Server & Database**: Managed relational database service.
- **Application Insights** (with Log Analytics): For application performance monitoring and logging.
- **Log Analytics Workspace**: Centralized logging platform for Azure resources. Diagnostic logs from ACR are also sent here.

> **Note on SQL Firewall:** The current Terraform configuration includes a broad firewall rule for Azure SQL (`0.0.0.0` to `0.0.0.0`), allowing access from any Azure service. For production environments, it is highly recommended to restrict access to specific Virtual Networks or IP addresses for enhanced security.

## GitHub Actions CI/CD

### `.github/workflows/infra.yml`

- Deploys all infrastructure using Terraform
- Installs `ingress-nginx` Helm chart for the Ingress controller.
- Installs `cert-manager` Helm chart for TLS certificate management.
- Installs `kube-prometheus-stack` Helm chart for comprehensive cluster monitoring.

### `.github/workflows/deploy.yml`

- Builds Docker images for the .NET app and the Angular client.
- Pushes the Docker images to Azure Container Registry (ACR).
- Lints the Helm chart to ensure its validity.
- Retrieves the SQL database connection string from Azure Key Vault.
- Creates a Kubernetes secret (`db-secret`) containing the connection string for the application to use.
- Renders the Helm chart for preview/validation.
- Deploys the container images to the AKS cluster using `helm upgrade`.

### `.github/workflows/destroy.yml`

- Destroys all infrastructure provisioned by Terraform.

## Requirements

- Azure Subscription
- GitHub Secrets:

  - `AZURE_CREDENTIALS`: JSON generated via:

    ```bash
    az ad sp create-for-rbac --name "github-deploy" --role Owner --scopes /subscriptions/<your-subscription-id> --sdk-auth
    ```

    > **Note:** The `Owner` role is required because the Terraform script needs to create a role assignment (`AcrPull` role) to allow the AKS cluster to pull images from the Azure Container Registry. The `Contributor` role does not have sufficient permissions for this action.

  - `TF_VAR_subscription_id`: your Azure subscription ID

    Example: `12345678-abcd-1234-ef00-0123456789ab`

  - `TF_VAR_sql_admin_login`: login for SQL Server admin user

    Example: `sqladminuser`

  - `TF_VAR_sql_admin_password`: password for SQL Server admin user

    Example: `MySecureP@ssw0rd!`

  - `TF_VAR_connection_string`: full connection string stored in Key Vault

    Example:

    ```
    Server=tcp:dotnetappazuredeploy-sqlsrv.database.windows.net,1433;
    Initial Catalog=dotnetappazuredeploy-db;
    Persist Security Info=False;
    User ID=sqladminuser;
    Password=MySecureP@ssw0rd!;
    MultipleActiveResultSets=False;
    Encrypt=True;
    TrustServerCertificate=False;
    Connection Timeout=30;
    ```

> These secrets are automatically passed as Terraform variables or used in workflows during execution in GitHub Actions.

## Usage

1. **Clone the repository**.
2. **Set up GitHub Secrets**:

   In your repository, go to:

   `Settings → Secrets and variables → Actions → New repository secret`

   Add the following secrets:

   - `AZURE_CREDENTIALS` using `az ad sp create-for-rbac` as described above
   - `TF_VAR_subscription_id`
   - `TF_VAR_sql_admin_login`
   - `TF_VAR_sql_admin_password`
   - `TF_VAR_connection_string`

3. **Trigger workflows manually** via the **Actions** tab on GitHub:

   - `infra.yml` - provisions infrastructure
   - `deploy.yml` - builds and deploys the application

4. Once deployed, the application will be running in the AKS cluster. To access the application, you can use `kubectl port-forward` or configure an Ingress controller.

   Example using `kubectl port-forward`:

   ```bash
   # Forward the API service
   kubectl port-forward svc/mywebapp-my-release 8080:80

   # Forward the client service
   kubectl port-forward svc/mywebapp-client-my-release 8081:80
   ```

   You can then access the API at `http://localhost:8080` and the client at `http://localhost:8081`.

   Alternatively, to access the application externally via the `ingress-nginx` controller:

   1. **Get the external IP address of the `ingress-nginx` controller**:

      ```bash
      kubectl get services -n ingress-nginx
      ```

      Look for the service named `ingress-nginx-controller` and note its `EXTERNAL-IP`. You can also find this external IP in the Azure portal in your `dotnetappazuredeploy-aks` Kubernetes service, under the **Services and ingresses** blade.

   2. **Access the application using the external IP**:

      Once you have the `EXTERNAL-IP` (let's assume it's `50.85.171.183` for this example), you can access:

      - **Angular Client**: `https://50.85.171.183/`
      - **API Endpoint**: `https://50.85.171.183/api/customers` (or other API routes)

      Note: If `cert-manager` has successfully provisioned a certificate, you should be able to access it via HTTPS. If not, you might need to use HTTP.

5. Push to **main** branch to automatically trigger deployment via GitHub Actions (deploy.yml).

## Helm Chart Deployment

The application is deployed to the AKS cluster using a Helm chart located in `infra/charts/mywebapp`. This Helm chart deploys both the .NET Web API (backend) and the Angular client (frontend) applications.

- The API deployment is configured via the default `values.yaml` file.
- The client deployment has its specific configurations in `values-client.yaml`, which overrides the default values for the client-side container. This typically includes Nginx configuration for serving static files and environment variables for the Angular application to communicate with the backend API.

The CI/CD pipeline leverages `helm upgrade --install` to deploy the application, utilizing both `values.yaml` and `values-client.yaml` for comprehensive configuration.

> **Note on Cluster Services:** Essential Kubernetes cluster services such as `ingress-nginx` (for Ingress Controller), `cert-manager` (for TLS certificate management), and `kube-prometheus-stack` (for monitoring) are deployed via Helm CLI commands within the `.github/workflows/infra.yml` workflow, _after_ the AKS cluster is provisioned by Terraform. This approach simplifies Terraform provisioning by avoiding Helm provider bootstrap complexities.

## Scalability

This project provides a baseline configuration for scalability, which can be adjusted at both the infrastructure (cluster) and application levels.

### Cluster-level Scalability (AKS Nodes)

- **Manual Scaling (Azure Portal/CLI):** The AKS cluster is provisioned by Terraform (`infra/main.tf`) with a single node pool (`default_node_pool`) and a fixed node count of 1 (`node_count = 1`). You can manually scale the number of nodes in the Azure Portal by navigating to your AKS resource -> Node pools, selecting the `default` pool, and changing the node count.
- **Auto Scaling (Cluster Autoscaler):** The Cluster Autoscaler is not enabled by default. To enable it, you would need to modify the `azurerm_kubernetes_cluster` resource in `infra/main.tf` to include an `auto_scaler_profile`. This would allow the cluster to automatically add or remove nodes based on the resource demands of your running pods. You can also enable Autoscale directly in the Azure portal (AKS resource -> Node pools, selecting the `default` pool).

### Application-level Scalability (Pods)

- **Manual Scaling (Helm Values):**

  - **Backend API:** The number of pods is controlled by the `replicaCount` value in `infra/charts/mywebapp/values.yaml`. By default, it is set to `1`. You can increase this number to manually scale out the backend.
  - **Frontend:** The number of frontend pods is currently hardcoded to `1` in the `infra/charts/mywebapp/templates/client-deployment.yaml` file.

- **Auto Scaling (Horizontal Pod Autoscaler):**
  - A `HorizontalPodAutoscaler` (HPA) is not included in the Helm chart by default. To enable autoscaling for the backend or frontend, you would need to:
    1.  Define an HPA resource in a new template file (e.g., `hpa.yaml`) within the Helm chart.
    2.  The HPA would target a deployment (e.g., `mywebapp` or `mywebapp-client`) and define metrics for scaling (e.g., CPU or memory utilization).
    3.  Ensure that resource requests and limits are properly set in the `deployment.yaml` for the HPA to function correctly.

## Frontend-Backend Communication

Communication between the Angular frontend and the .NET backend is handled entirely within the Kubernetes cluster using a reverse proxy pattern managed by the `ingress-nginx` controller.

1.  **Backend Exposure:** The .NET backend is exposed internally via a Kubernetes service named `mywebapp-my-release-svc`.
2.  **Frontend Exposure:** The Angular frontend is exposed internally via a service named `mywebapp-client-my-release`.
3.  **Angular Configuration:** The Angular application's production configuration (`src/MyWebApp.Client/src/environments/environment.prod.ts`) sets its API URL to a relative path: `apiUrl: '/api/'`. This means when the application is loaded in a browser, it sends API requests to the same host it was served from, but with the `/api/` prefix (e.g., `https://<your-host>/api/customers`).
4.  **Ingress Routing (Reverse Proxy):** The `ingress-nginx` controller routes incoming traffic based on the URL path:
    - **Backend Ingress (`ingress.yaml`):** It is configured to route any request with the path prefix `/api` to the backend service (`mywebapp-my-release-svc`). The annotation `nginx.ingress.kubernetes.io/rewrite-target: /` strips the `/api` prefix before forwarding the request, so the backend application receives clean paths (e.g., `/customers`).
    - **Frontend Ingress (`client-ingress.yaml`):** It handles all other traffic (`/`) and routes it to the frontend service, serving the Angular application.

This setup allows both frontend and backend to be served from a single domain and port, simplifying configuration and avoiding Cross-Origin Resource Sharing (CORS) issues.

## Troubleshooting & Known Issues

### Terraform State File

The `destroy.yml` workflow includes a note about the Terraform state file. By default, the state is stored locally on the GitHub Actions runner, which is not persistent. It is highly recommended to configure a remote backend (e.g., Azure Storage Account) to store the Terraform state file. This will ensure that the state is preserved between runs and that `terraform destroy` works as expected.

### Purging deleted Key Vault secrets (after terraform destroy)

If you destroy infrastructure and get an error like:

> A resource with the ID ".../secrets/ConnectionStrings--DefaultConnection/..." already exists...

Purge it manually:

```bash
az keyvault list-deleted --output table
az keyvault purge --name dotnetappazuredeploykv
```

### Diagnostic Settings conflict

If Terraform fails with:

> A resource with the ID "...apim-diagnostics..." already exists...

List and delete it:

```bash
az monitor diagnostic-settings list --resource ...
az monitor diagnostic-settings delete --name ...
```

Example:

```bash
az monitor diagnostic-settings list --resource "dotnetappazuredeploy-apim" --resource-group "dotnetappazuredeploy-rg" --resource-type "Microsoft.ApiManagement/service"

az monitor diagnostic-settings delete --name apim-monitor-diagnostics --resource "dotnetappazuredeploy-apim" --resource-group "dotnetappazuredeploy-rg" --resource-type "Microsoft.ApiManagement/service"
```

### Key Vault: “Soft Deleted” and Access Policy Issues

#### Problem:

- Azure Key Vault names are **globally unique**, not just within a subscription.
- If you delete a Key Vault and **soft delete** is enabled (default), the vault remains in a “soft deleted” state for 7 days.
- When Terraform tries to recreate a Key Vault with the same name, Azure **restores the old one** (including old Access Policies).

This can cause errors such as:

> `403 Forbidden: The client does not have secrets get permission on key vault`

This happens because **old Access Policies no longer match your current Service Principal** (used in `AZURE_CREDENTIALS` within GitHub Actions).  
If you recreated the Service Principal or changed its permissions, the restored Key Vault may still contain outdated access policies pointing to the old identity.

#### Solutions:

Purge the Old Key Vault (Recommended)

This option immediately removes the resource, allowing Terraform to create a new one with the correct settings.

1.  **List soft-deleted vaults:**

    ```bash
    az keyvault list-deleted
    ```

2.  **Permanently remove (purge) the old one:**

    ```bash
    az keyvault purge --name <key_vault_name> --location <location>
    ```

    Example:

    ```bash
    az keyvault purge --name dotnetappazuredeploykv --location westeurope
    ```

    Remember to replace `dotnetappazuredeploykv` and `westeurope` with your appropriate values.

> **Note:** This operation **requires sufficient permissions** in Azure (e.g., **Owner** or **User Access Administrator** role).

# Monitoring

The `infra.yml` workflow installs the `kube-prometheus-stack` Helm chart, which provides a comprehensive, pre-configured monitoring solution for the Kubernetes cluster using Prometheus and Grafana.

## Accessing Grafana

You can access the Grafana dashboard locally using `kubectl port-forward`.

1.  **Forward the Grafana service port:**

    ```bash
    kubectl port-forward svc/monitoring-grafana -n monitoring 3000:80
    ```

2.  **Access the dashboard:**
    Open your browser and navigate to `http://localhost:3000`.

3.  **Login Credentials:**

    - **Username:** `admin`
    - **Password:** Run the following command to retrieve the auto-generated password from the Kubernetes secret:

      ```bash
      kubectl get secret -n monitoring monitoring-grafana -o jsonpath="{.data.admin-password}" | base64 --decode
      ```

Once logged in, you will find several pre-configured dashboards for monitoring the cluster's health, nodes, pods, and more. Your .NET application's metrics will also be scraped by Prometheus and will be available for building custom dashboards.

# Notes

- Resource names are examples; adapt them for your environment.
- The infrastructure is minimal and intended for demo/testing purposes.
- The sample passwords, logins, demo URLs are placeholders and should never be used in production. Use GitHub Secrets to store sensitive values.

## Accessing Applications in AKS using Port-Forwarding

To perform port-forwarding for applications in AKS, you need:

1.  **Configured `kubectl`**: Ensure your `kubectl` is configured to connect to your AKS cluster. This is typically done using the `az aks get-credentials` command.

    ```bash
    az aks get-credentials --resource-group <your-resource-group-name> --name <your-aks-cluster-name>
    ```

2.  **Pod Name**: You need to know the name of the pod to which you want to forward traffic. You can find it by listing pods in the appropriate namespace:

    ```bash
    kubectl get pods -n <your-namespace>
    ```

    For example, if your `mywebapp` application is running in the `default` namespace, you can look for a pod name containing `mywebapp`.

### Example Port-Forwarding for `mywebapp`:

If you want to access the `mywebapp` application, which listens on port 80 inside the pod:

1.  **Find your application's pod name:**

    ```bash
    kubectl get pods -n default -l app.kubernetes.io/name=mywebapp
    # Replace 'default' with your namespace, if different.
    # Use the selector '-l app.kubernetes.io/name=mywebapp' to filter pods,
    # or simply 'kubectl get pods -n default' and find the appropriate name.
    ```

    The result will look something like: `mywebapp-xxxxxxxxxx-yyyyy`.

2.  **Perform port-forwarding:**

    ```bash
    kubectl port-forward pod/mywebapp-xxxxxxxxxx-yyyyy 8080:80 -n default
    # Replace 'mywebapp-xxxxxxxxxx-yyyyy' with your actual application pod name.
    # '8080' is the port on your local machine.
    # '80' is the port your application listens on inside the pod.
    # 'default' is the pod's namespace.
    ```

    After executing this command, you can open your browser and navigate to `http://localhost:8080` to access your application.

### Port-Forwarding for Prometheus / Grafana (if they are in the same cluster):

If Prometheus and Grafana are deployed in the same cluster (often in the `monitoring` or `prometheus` / `grafana` namespace), you can use the same method:

1.  **Find the Prometheus / Grafana pod name:**

    ```bash
    kubectl get pods -n monitoring -l app=prometheus # for Prometheus
    kubectl get pods -n monitoring -l app=grafana # for Grafana
    ```

2.  **Perform port-forwarding:**

    - For Prometheus (default port 9090):

      ```bash
      kubectl port-forward pod/prometheus-server-xxxxxxxxxx-yyyyy 9090:9090 -n monitoring
      ```

      Then open `http://localhost:9090`.

    - For Grafana (default port 3000):

      ```bash
      kubectl port-forward pod/grafana-xxxxxxxxxx-yyyyy 3000:3000 -n monitoring
      ```

      Then open `http://localhost:3000`.
