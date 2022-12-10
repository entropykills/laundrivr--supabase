# get the value of the flag set for deployment type (development or production)
while getopts t: flag
do
    case "${flag}" in
        t) type=${OPTARG};;
    esac
done

# if the flag is missing then exit the script
if [ -z "$type" ]; then
    echo "Please set the deployment type using the -t flag"
    exit 1
fi

# if the deployment type is production then set the env file name
# to .env.production and if it is development then set the env file
# name to .env.development
if [ "$type" = "production" ]; then
    env_file=".env.production"
elif [ "$type" = "development" ]; then
    env_file=".env.development"
fi

# set the supabase secrets to the environment variables
supabase secrets set --env-file "$env_file"

for d in ./supabase/functions/* ; do
    # get the last part of the path
    d=${d##*/}
    # if the directory name is "_shared" skip it
    if [ "$d" = "_shared" ]; then
        continue
    fi
    # deploy the function with the same name as the directory
    supabase functions deploy "$d"
    echo "$d"
done