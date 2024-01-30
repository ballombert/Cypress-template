import argparse
import json
import os
import shutil
from time import sleep

from azure.core.exceptions import ResourceExistsError
from azure.storage.blob import BlobServiceClient, ContainerClient
from azure.data.tables import TableServiceClient
from azure.core.credentials import AzureNamedKeyCredential

"""
a dict to store table_client for each table_name  
"""
table_client_dict = {}
def insert_data_into_tables(login:str, token:str, endpoint:str, directory:str ) :
    credential = AzureNamedKeyCredential(login, token)
    table_service_client = TableServiceClient(endpoint=endpoint, credential=credential)
    for file_name in os.listdir(directory):
        file_path = os.path.join(directory, file_name)
        if os.path.isfile(file_path):
            with open(file_path, "r") as data:
                """
                read json data from file and convert it to array
                """
                file_data = data.read()
                json_data = json.loads(file_data)
                file_name = os.path.splitext(file_name)[0]                
                if(file_name in table_client_dict):
                    table_client = table_client_dict[file_name]
                    print("insert data into table:"+file_name)                    
                    for data in json_data:
                        print(data)
                        table_client.upsert_entity(data)
                    
                else:
                    try:
                        print("create table:"+file_name)
                        table_service_client.create_table(table_name=file_name)
                    except Exception as e:
                        print("Error when crating table! " + str(e))
                    table_client = table_service_client.get_table_client(table_name=file_name)
                    
                    if args.delete==True:
                        queried_entities = table_client.query_entities("")
                        for entity_chosen in queried_entities:
                            table_client.delete_entity(row_key=entity_chosen["RowKey"], partition_key=entity_chosen["PartitionKey"])

                    table_client_dict[file_name] = table_client
                    print("insert data into table:"+file_name)
                    for data in json_data:
                        print(data)
                        table_client.upsert_entity(data)
        elif os.path.isdir(file_path):
            insert_data_into_tables(login, token, endpoint, file_path)


def copytree(src, dst, symlinks=False, ignore=None):
    if not os.path.exists(dst):
        os.makedirs(dst)
    for item in os.listdir(src):
        s = os.path.join(src, item)
        d = os.path.join(dst, item)
        if os.path.isdir(s):
            copytree(s, d, symlinks, ignore)
        else:
            if not os.path.exists(d) or os.stat(s).st_mtime - os.stat(d).st_mtime > 1:
                shutil.copy2(s, d)

def clear_containers(
    service_client: BlobServiceClient, containers_directory: str
) -> None:
    for container_name in os.listdir(containers_directory):
        print("delete container:"+container_name)
        try:
            container_client = service_client.get_container_client(container_name)
            container_client.delete_container()
        except:
            print("Could not delete container:"+container_name)            

def move_qa_files(path: str, dest: str) -> None:
    """
    Move QA strorage directory to a path inside the init container.
    """
    print(f"copy file {path} from {dest}" )
    for directory_name in os.listdir(path):
        directory_path = os.path.join(path, directory_name)
        if os.path.isdir(directory_path):
            print(directory_path)
            for container_name in os.listdir(directory_path):
                print(container_name)
                container_path = os.path.join(directory_path, container_name)
                if os.path.isdir(container_path):
                    for blob_name in os.listdir(container_path):
                        blob_path = os.path.join(container_path, blob_name)
                        print(blob_path)
                        if os.path.isfile(blob_path):
                            dest_path= os.path.join(args.directory, container_name, blob_name)
                            print("Move...",blob_name)
                            shutil.move(blob_path,dest_path)
                        elif os.path.isdir(blob_path):
                            dest_path= os.path.join(args.directory, container_name, blob_name)
                            print(f"Move... {dest_path} => {dest_path}")
                            copytree(blob_path,dest_path)



                    

 
def upload_file(container_client: ContainerClient, source: str, dest: str) -> None:
    """
    Upload a single file to a path inside the container.
    """
    print(f"Uploading {source} to {dest}")
    with open(source, "rb") as data:
        try:
            if source.endswith(".tags"):
                return            
            elif os.path.isfile(source+".tags"):
                json_tags = json.loads(open(source+".tags").read());        
                container_client.upload_blob(name=dest, data=data, tags=json_tags)
            else:
                container_client.upload_blob(name=dest, data=data)                            
        except:
            print("impossible to upload file :"+dest)


def upload_dir(container_client: ContainerClient, source: str, dest: str) -> None:
    """
    Upload a directory to a path inside the container.
    """
    prefix = "" if dest == "" else dest + "/"
    prefix += os.path.basename(source) + "/"
    for root, dirs, files in os.walk(source):
        for name in files:
            dir_part = os.path.relpath(root, source)
            dir_part = "" if dir_part == "." else dir_part + "/"
            file_path = os.path.join(root, name)
            blob_path = prefix + dir_part + name            
            upload_file(container_client, file_path, blob_path)

def init_containers(
    service_client: BlobServiceClient, containers_directory: str
) -> None:
    """
    Iterate on the containers directory and do the following:
    1- create the container.
    2- upload all folders and files to the container.
    """
    for container_name in os.listdir(containers_directory):
        container_path = os.path.join(containers_directory, container_name)
        if os.path.isdir(container_path):
            container_client = service_client.get_container_client(container_name.strip())
            
            try:
                print("\tCreate container "+container_name)
                container_client.create_container()
            except ResourceExistsError:
                print("\tcontainer already exist "+container_name)                                
            for blob in os.listdir(container_path):
                blob_path = os.path.join(container_path, blob)
                if os.path.isdir(blob_path):
                    upload_dir(container_client, blob_path, "")
                else:
                    upload_file(container_client, blob_path, blob)


if __name__ == "__main__":
    print("Start Init Containers...")
    parser = argparse.ArgumentParser(
        description="Initialize azurite emulator containers."
    )
    parser.add_argument(
        "--directory",
        required=True,
        help="""
        Directory that contains subdirectories named after the 
        containers that we should create. Each subdirectory will contain the files
         and directories of its container.
        """
    )

    parser.add_argument(
        "--azuretableDirectory",
        required=False,
        default="",
        help="""
        QA Directory that contains subdirectories and file named after the 
        table that we should create. Each subdirectory will the files with 
        json data to insert into azure table.
        """
    )

    parser.add_argument(
        "--fixtureDirectory",
        required=False,
        default="",
        help="""
        QA Directory that contains subdirectories named after the 
        containers that we should create. Each subdirectory will contain the files
         and directories of its container.
        """
    )
    parser.add_argument(
        "--url",
        default="http://localhost:10000/devstoreaccount1",
        help="""
        Url of the storage
        """
    )

    parser.add_argument(
        "--endpointtable",
        default="",
        help="""
        Url of the table
        """
    )

    parser.add_argument(
        "--login",
        default="devstoreaccount1",
        help="""
        login 
        """
    )
    parser.add_argument(
        "--token",
        default="Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==",
        help="""
        access token
        """
    )
    
    parser.add_argument(
        "--delete",
        default=False, 
        action="store_true",
        help="""
        delete all containers before insert files
        """
    )
    args = parser.parse_args()

    if args.fixtureDirectory!="":
        move_qa_files(args.fixtureDirectory, args.directory)
    # Connect to the localhost emulator (after 5 secs to make sure it's up).
    sleep(10)
    print(args.url)
    print(args.login)
    print(args.token)
    
    if args.delete==True:
        clientForDelete = BlobServiceClient(
        account_url=args.url,
        credential={
            "account_name": args.login,
            "account_key": args.token
        }
    )
        print("Delete containers ...")
        clear_containers(clientForDelete, args.directory)
        sleep(60)
    # Only initialize if not already initialized.
    blob_service_client = BlobServiceClient(
        account_url=args.url,
        credential={
            "account_name": args.login,
            "account_key": args.token
        }
    )
    init_containers(blob_service_client, args.directory)

    if args.azuretableDirectory!="":
        print("Insert data into tables ...")
        try:
            insert_data_into_tables(args.login, args.token, args.endpointtable, args.azuretableDirectory)
        except Exception as e:
            print("Fail to init data table : " + str(e))
        